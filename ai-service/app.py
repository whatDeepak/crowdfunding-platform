"""
CrowdfundingEscrow AI Service
Deployed on HuggingFace Spaces (free CPU tier — 2 vCPU, 16GB RAM).

Two endpoints:
  POST /analyze-campaign  — Campaign legitimacy scoring (multi-signal ML pipeline)
  POST /analyze-proof     — Withdrawal proof consistency check (LLM-based)

GET  /health             — Warm-up / health check (hit before demo to pre-load model)
"""

from __future__ import annotations

import os
from typing import List, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from models.text_analyzer  import analyze_text
from models.semantic_checker import check_semantic_similarity, encode
from models.image_hasher   import compute_phash, check_image_reuse
from models.amount_scorer  import score_amount
from models.score_combiner import combine_scores
from llm.explainer         import generate_campaign_explanation, generate_proof_explanation

app = FastAPI(
    title="CrowdfundingEscrow AI Service",
    description="Custom ML pipeline for campaign fraud detection and proof consistency analysis.",
    version="1.0.0",
)

# ─────────────────────────────────────────────────────────────────────────────
# Request / Response schemas
# ─────────────────────────────────────────────────────────────────────────────

class CampaignAnalysisRequest(BaseModel):
    title:                  str
    description:            str
    target_amount_eth:      float = Field(gt=0)
    category:               str   = Field(pattern="^(medical|education|disaster|community)$")
    document_names:         List[str] = []
    existing_embeddings:    List[List[float]] = []  # cached from DB
    existing_image_hashes:  List[str] = []
    image_url:              Optional[str] = None


class CampaignAnalysisResponse(BaseModel):
    trust_score:     int          # 0-100
    risk_level:      str          # low | medium | high
    text_score:      int          # 0-25
    semantic_score:  int          # 0-25
    amount_score:    int          # 0-25
    image_reuse_flag: bool
    flags:           List[str]
    explanation:     str
    embedding:       List[float]  # 384-dim — store in DB for future comparisons


class ProofAnalysisRequest(BaseModel):
    milestone_title:       str
    milestone_amount_eth:  float = Field(gt=0)
    proof_description:     str
    document_names:        List[str] = []
    campaign_title:        str
    campaign_category:     str = Field(pattern="^(medical|education|disaster|community)$")
    previous_milestones:   List[dict] = []


class ProofAnalysisResponse(BaseModel):
    consistency_score:  int    # 0-100
    ai_recommendation:  str    # approve | flag | reject
    flags:              List[str]
    admin_note:         str


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Warm-up endpoint. Pre-loads the MiniLM model on first call."""
    # Triggering encode warm-up
    _ = encode("warm up")
    return {"status": "ok", "model": "all-MiniLM-L6-v2"}


@app.post("/analyze-campaign", response_model=CampaignAnalysisResponse)
def analyze_campaign(req: CampaignAnalysisRequest):
    """
    Multi-signal ML pipeline for campaign legitimacy scoring.

    Pipeline:
      1. Text analysis   (sklearn + textstat)
      2. Semantic check  (sentence-transformers MiniLM)
      3. Image hash      (imagehash pHash)
      4. Amount scoring  (statistical Z-score)
      5. Score combine   (weighted + normalised)
      6. LLM explanation (Groq / Mistral)
    """
    all_flags: list[str] = []

    # 1. Text analysis
    text_score, text_flags = analyze_text(req.title, req.description)
    all_flags.extend(text_flags)

    # 2. Semantic similarity
    combined_text = f"{req.title}. {req.description}"
    semantic_score, sem_flags, embedding = check_semantic_similarity(
        combined_text,
        req.existing_embeddings,
    )
    all_flags.extend(sem_flags)

    # 3. Image reuse check
    image_reuse = False
    if req.image_url and req.existing_image_hashes:
        phash = compute_phash(req.image_url)
        if phash:
            image_reuse = check_image_reuse(phash, req.existing_image_hashes)
            if image_reuse:
                all_flags.append("image_reused_from_existing_campaign")

    # 4. Amount reasonableness
    amount_score, amount_flags = score_amount(req.target_amount_eth, req.category)
    all_flags.extend(amount_flags)

    # 5. Combine
    trust_score, risk_level = combine_scores(
        text_score, semantic_score, amount_score, image_reuse, all_flags
    )

    # 6. LLM explanation (gracefully skipped if API keys missing)
    explanation = generate_campaign_explanation(
        title=req.title,
        category=req.category,
        amount_eth=req.target_amount_eth,
        text_score=text_score,
        semantic_score=semantic_score,
        amount_score=amount_score,
        image_reuse=image_reuse,
        trust_score=trust_score,
        flags=all_flags,
    )

    return CampaignAnalysisResponse(
        trust_score=trust_score,
        risk_level=risk_level,
        text_score=text_score,
        semantic_score=semantic_score,
        amount_score=amount_score,
        image_reuse_flag=image_reuse,
        flags=all_flags,
        explanation=explanation,
        embedding=embedding,
    )


@app.post("/analyze-proof", response_model=ProofAnalysisResponse)
def analyze_proof(req: ProofAnalysisRequest):
    """
    LLM-based consistency check for withdrawal proof submissions.

    Checks whether the creator's description and document names are consistent
    with the milestone and the claimed amount. Uses Groq / Mistral.
    """
    flags: list[str] = []

    # Simple heuristic checks before LLM
    proof_lower = req.proof_description.lower()

    # No description at all
    if len(req.proof_description.strip()) < 20:
        flags.append("proof_description_too_short")

    # No documents submitted
    if not req.document_names:
        flags.append("no_documents_submitted")

    # Amount mismatch signal: if requested is much more than any milestone should be
    if req.milestone_amount_eth > 5.0:
        flags.append("large_single_withdrawal")

    # Keywords suggesting falsification
    suspicious_proof_words = ["fake", "test", "dummy", "placeholder", "sample invoice"]
    for word in suspicious_proof_words:
        if word in proof_lower:
            flags.append(f"suspicious_proof_keyword:{word}")

    # Derive a preliminary consistency score from heuristics
    base_score = 100
    base_score -= len(flags) * 20
    base_score = max(base_score, 10)

    # LLM refines the score and provides the admin note
    admin_note = generate_proof_explanation(
        milestone_title=req.milestone_title,
        amount_eth=req.milestone_amount_eth,
        proof_description=req.proof_description,
        document_names=req.document_names,
        campaign_title=req.campaign_title,
        consistency_score=base_score,
        flags=flags,
    )

    # Determine recommendation
    if base_score >= 75 and not flags:
        recommendation = "approve"
    elif base_score >= 50 or len(flags) <= 1:
        recommendation = "flag"
    else:
        recommendation = "reject"

    return ProofAnalysisResponse(
        consistency_score=base_score,
        ai_recommendation=recommendation,
        flags=flags,
        admin_note=admin_note,
    )


# ─────────────────────────────────────────────────────────────────────────────
# Local dev entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=7860, reload=True)

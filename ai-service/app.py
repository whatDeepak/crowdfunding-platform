"""
CrowdfundingEscrow AI Service — FastAPI  (Version 3)
Deployed on HuggingFace Spaces (free CPU tier).

Endpoints:
  POST /analyze-campaign  — 5-signal ML pipeline + document alignment + Groq Vision + LLM
  POST /analyze-proof     — heuristic + LLM consistency check for withdrawal proofs
  GET  /health            — warm-up (pre-loads MiniLM model)
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import List, Optional

# Load .env for local development (no-op if python-dotenv not installed or file absent)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from fastapi import FastAPI
from pydantic import BaseModel, Field

from models.text_analyzer    import analyze_text
from models.semantic_checker import check_semantic_similarity, encode
from models.image_hasher     import analyze_image, no_image_result
from models.amount_scorer    import score_amount
from models.entity_extractor import extract_description_entities, extract_document_entities
from models.document_aligner import align_documents
from models.score_combiner   import combine_scores
from llm.explainer           import generate_campaign_explanation, generate_proof_explanation

app = FastAPI(
    title="CrowdfundingEscrow AI Service",
    description="5-signal ML pipeline: text + semantic + amount + image + document alignment.",
    version="3.0.0",
)

# ── Schemas ───────────────────────────────────────────────────────────────────

class CampaignAnalysisRequest(BaseModel):
    title:                  str
    description:            str
    target_amount_eth:      float = Field(gt=0)
    category:               str   = Field(pattern="^(medical|education|disaster|community)$")
    document_ipfs_cids:     List[str] = []          # NEW — IPFS CIDs of uploaded docs
    existing_embeddings:    List[List[float]] = []
    existing_image_hashes:  List[str] = []
    image_url:              Optional[str] = None
    campaign_created_at:    Optional[str] = None    # ISO8601 for timeline validation


class CampaignAnalysisResponse(BaseModel):
    trust_score:             int           # 0-100
    risk_level:              str           # low | medium | high
    text_score:              int           # 0-25 (raw)
    semantic_score:          int           # 0-25 (raw)
    amount_score:            int           # 0-25 (raw)
    image_score:             int           # 0-25 (raw)
    document_alignment_score: int          # 0-40 (NEW)
    image_reuse_flag:        bool
    is_ai_generated:         bool
    is_stock_photo:          bool
    vision_description:      str
    document_flags:          List[str]     # entity contradiction / timeline flags
    flags:                   List[str]     # combined flags
    explanation:             str
    embedding:               List[float]


class ProofAnalysisRequest(BaseModel):
    milestone_title:       str
    milestone_amount_eth:  float = Field(gt=0)
    proof_description:     str
    proof_ipfs_cid:        Optional[str] = None     # IPFS CID of the actual proof document
    document_names:        List[str] = []
    campaign_title:        str
    campaign_category:     str = Field(pattern="^(medical|education|disaster|community)$")
    previous_milestones:   List[dict] = []


class ProofAnalysisResponse(BaseModel):
    consistency_score:  int
    ai_recommendation:  str
    flags:              List[str]
    admin_note:         str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """Pre-loads MiniLM on first call (~10-30s cold start on HF Spaces CPU)."""
    _ = encode("warm up")
    return {"status": "ok", "model": "all-MiniLM-L6-v2", "version": "3.0.0"}


@app.post("/analyze-campaign", response_model=CampaignAnalysisResponse)
def analyze_campaign(req: CampaignAnalysisRequest):
    """
    5-signal ML pipeline:
      1. Text quality       (sklearn TF-IDF + textstat)           → 0-25
      2. Semantic duplicate (MiniLM cosine similarity)            → 0-25
      3. Amount Z-score     (statistical reasonableness)          → 0-25
      4. Image intelligence (pHash + Groq Vision)                 → 0-25
      5. Document alignment (entity extraction + cross-validation) → 0-40
         (signals 1-4 scaled to 60% total; doc alignment = 40%)
      → LLM synthesis (Groq llama-3.3-70b → admin explanation)
    """
    all_flags:   list[str] = []
    doc_flags:   list[str] = []

    # Signal 1 — Text quality
    text_score, text_flags = analyze_text(req.title, req.description)
    all_flags.extend(text_flags)

    # Signal 2 — Semantic duplicate detection
    combined_text = f"{req.title}. {req.description}"
    semantic_score, sem_flags, embedding = check_semantic_similarity(
        combined_text, req.existing_embeddings
    )
    all_flags.extend(sem_flags)

    # Signal 3 — Amount statistical reasonableness
    amount_score, amount_flags = score_amount(req.target_amount_eth, req.category)
    all_flags.extend(amount_flags)

    # Signal 4 — Image intelligence (pHash + Groq Vision)
    if req.image_url:
        img_result = analyze_image(
            image_url=req.image_url,
            title=req.title,
            category=req.category,
            existing_phashes=req.existing_image_hashes,
        )
    else:
        img_result = no_image_result()
    all_flags.extend(img_result.flags)

    # Signal 5 — Document-story alignment
    campaign_dt: Optional[datetime] = None
    if req.campaign_created_at:
        try:
            campaign_dt = datetime.fromisoformat(req.campaign_created_at.replace("Z", "+00:00"))
        except Exception:
            pass

    desc_entities = extract_description_entities(req.description, req.title, req.category)

    doc_entities: list[dict] = []
    for cid in req.document_ipfs_cids[:5]:  # limit to 5 docs to control cost
        doc_entity = extract_document_entities(cid)
        doc_entities.append(doc_entity)

    document_score, doc_flags = align_documents(desc_entities, doc_entities, campaign_dt)
    all_flags.extend(doc_flags)

    # Combine — 5-signal weighted (see score_combiner for weight details)
    trust_score, risk_level = combine_scores(
        text_score, semantic_score, amount_score, img_result.image_score,
        document_score, all_flags,
    )

    # LLM synthesis
    explanation = generate_campaign_explanation(
        title=req.title,
        category=req.category,
        amount_eth=req.target_amount_eth,
        text_score=text_score,
        semantic_score=semantic_score,
        amount_score=amount_score,
        image_score=img_result.image_score,
        document_score=document_score,
        trust_score=trust_score,
        flags=all_flags,
        image_reuse=img_result.image_reuse_flag,
        is_ai_generated=img_result.is_ai_generated,
        is_stock_photo=img_result.is_stock_photo,
        vision_description=img_result.vision_description,
        doc_flags=doc_flags,
    )

    return CampaignAnalysisResponse(
        trust_score=trust_score,
        risk_level=risk_level,
        text_score=text_score,
        semantic_score=semantic_score,
        amount_score=amount_score,
        image_score=img_result.image_score,
        document_alignment_score=document_score,
        image_reuse_flag=img_result.image_reuse_flag,
        is_ai_generated=img_result.is_ai_generated,
        is_stock_photo=img_result.is_stock_photo,
        vision_description=img_result.vision_description,
        document_flags=doc_flags,
        flags=all_flags,
        explanation=explanation,
        embedding=embedding,
    )


def _score_proof_document(proof_doc: dict, milestone_amount_eth: float) -> tuple[int, list[str]]:
    """Adjust consistency score based on OCR'd proof document. Returns (delta, flags)."""
    delta: int = 0
    flags: list[str] = []

    doc_type = proof_doc.get("doc_type", "other")

    if doc_type == "download_failed":
        flags.append("proof_document_fetch_failed")
        return -5, flags

    if doc_type == "pdf_unrendered":
        # PDF was uploaded but poppler couldn't render it — give partial credit
        return 5, flags

    if doc_type == "unreadable":
        flags.append("proof_document_unreadable")
        return -10, flags

    GOOD_PROOF_TYPES = {"invoice", "receipt", "medical_record", "prescription", "discharge_summary", "certificate"}
    if doc_type in GOOD_PROOF_TYPES:
        delta += 15
    elif doc_type == "id_proof":
        delta -= 5
        flags.append("wrong_document_type_for_proof")
    else:
        delta += 5

    doc_amount = proof_doc.get("amount")
    if doc_amount is not None:
        try:
            cleaned = str(doc_amount).replace(",", "").strip()
            for sym in ["₹", "$", "€", "£", "¥", "Rs", "INR", "USD"]:
                cleaned = cleaned.replace(sym, "")
            amt = float(cleaned.strip())
            if amt > 0:
                delta += 10
            else:
                flags.append("document_shows_zero_amount")
                delta -= 5
        except (ValueError, TypeError):
            pass

    doc_date_str = proof_doc.get("date")
    if doc_date_str:
        try:
            import dateparser
            from datetime import datetime, timedelta
            doc_date = dateparser.parse(str(doc_date_str))
            if doc_date:
                now = datetime.now()
                if doc_date > now + timedelta(days=1):
                    flags.append("proof_document_future_dated")
                    delta -= 20
                elif (now - doc_date).days > 365:
                    flags.append("proof_document_too_old")
                    delta -= 10
        except Exception:
            pass

    return delta, flags


@app.post("/analyze-proof", response_model=ProofAnalysisResponse)
def analyze_proof(req: ProofAnalysisRequest):
    """Heuristic + document OCR + LLM consistency check for withdrawal proof submissions."""
    flags: list[str] = []
    proof_lower = req.proof_description.lower()

    if len(req.proof_description.strip()) < 20:
        flags.append("proof_description_too_short")
    if not req.document_names:
        flags.append("no_documents_submitted")
    if req.milestone_amount_eth > 5.0:
        flags.append("large_single_withdrawal")

    for word in ["fake", "test", "dummy", "placeholder", "sample invoice"]:
        if word in proof_lower:
            flags.append(f"suspicious_proof_keyword:{word}")

    base_score = max(100 - len(flags) * 20, 10)

    # Read and cross-validate the actual proof document if a CID was provided
    if req.proof_ipfs_cid:
        proof_doc = extract_document_entities(req.proof_ipfs_cid)
        doc_delta, doc_flags = _score_proof_document(proof_doc, req.milestone_amount_eth)
        base_score = max(10, min(100, base_score + doc_delta))
        flags.extend(doc_flags)
    else:
        flags.append("proof_document_cid_not_provided")

    admin_note = generate_proof_explanation(
        milestone_title=req.milestone_title,
        amount_eth=req.milestone_amount_eth,
        proof_description=req.proof_description,
        document_names=req.document_names,
        campaign_title=req.campaign_title,
        consistency_score=base_score,
        flags=flags,
    )

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


@app.on_event("startup")
def startup_validation():
    missing = [key for key in ("GROQ_API_KEY",) if not os.getenv(key)]
    if missing:
        print(f"WARNING: Missing env vars: {', '.join(missing)} — Vision and LLM calls will fail")
    else:
        print("✓ GROQ_API_KEY present — AI pipeline ready")


if __name__ == "__main__":
    import uvicorn
    # reload=False avoids multiprocessing spawn issues on Windows
    uvicorn.run("app:app", host="0.0.0.0", port=7860, reload=False)

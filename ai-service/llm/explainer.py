"""
LLM explanation and final score synthesis.

Uses Groq llama-3.3-70b-versatile (strong reasoning) for both:
  - Campaign analysis explanation (takes all 4 signal scores + vision result)
  - Withdrawal proof consistency review

Falls back to Mistral if Groq fails.
Falls back to a template string if both fail.
"""

from __future__ import annotations

import os
from typing import List, Optional

_groq_client   = None
_mistral_client = None


def _get_groq():
    global _groq_client
    if _groq_client is None:
        from groq import Groq
        _groq_client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))
    return _groq_client


def _get_mistral():
    global _mistral_client
    if _mistral_client is None:
        from mistralai import Mistral
        _mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY", ""))
    return _mistral_client


# ── Campaign explanation ──────────────────────────────────────────────────────

def _build_campaign_prompt(
    title:             str,
    category:          str,
    amount_eth:        float,
    text_score:        int,
    semantic_score:    int,
    amount_score:      int,
    image_score:       int,
    document_score:    int,
    trust_score:       int,
    flags:             List[str],
    image_reuse:       bool,
    is_ai_generated:   bool,
    is_stock_photo:    bool,
    vision_description: str,
    doc_flags:         List[str],
) -> str:
    flag_str = ", ".join(flags) if flags else "none"

    image_summary = []
    if vision_description:
        image_summary.append(f'Image shows: "{vision_description}"')
    if image_reuse:
        image_summary.append("Image reused from another campaign (REUSE FLAG).")
    if is_ai_generated:
        image_summary.append("Image appears AI-generated or synthetic.")
    if is_stock_photo:
        image_summary.append("Image appears to be a generic stock photo.")
    image_str = " ".join(image_summary) if image_summary else "No image provided."

    doc_summary = ", ".join(doc_flags) if doc_flags else "No document issues detected."

    # Scaled weights for display
    adj_text     = round(text_score     * 20 / 25)
    adj_semantic = round(semantic_score * 15 / 25)
    adj_amount   = round(amount_score   * 15 / 25)
    adj_image    = round(image_score    * 10 / 25)

    return f"""You are a senior fraud analyst for a blockchain-based crowdfunding platform.
Review the AI pipeline results for a new campaign and write a concise admin note.

CAMPAIGN
  Title:    "{title}"
  Category: {category}
  Amount:   {amount_eth:.4f} ETH

SIGNAL SCORES (weighted total out of 100)
  Text quality:           {adj_text}/20
  Semantic uniqueness:    {adj_semantic}/15
  Amount reasonableness:  {adj_amount}/15
  Image authenticity:     {adj_image}/10
  Document alignment:     {document_score}/40  ← story vs. uploaded proof match
  ─────────────────────────────────────────
  Trust score:            {trust_score}/100

IMAGE ANALYSIS
  {image_str}

DOCUMENT ALIGNMENT
  {doc_summary}

ALL FLAGS
  {flag_str}

TASK
Write exactly 2-3 sentences for the platform admin. Be direct and factual.
If trust score < 40: state why the campaign is high risk and what is missing.
If 40-69: identify the main gap (usually document evidence) and what would help.
If ≥ 70: confirm the campaign appears legitimate and highlight strongest signal.
Do NOT use bullet points or markdown."""


def generate_campaign_explanation(
    title:             str,
    category:          str,
    amount_eth:        float,
    text_score:        int,
    semantic_score:    int,
    amount_score:      int,
    image_score:       int,
    document_score:    int = 0,
    trust_score:       int = 0,
    flags:             Optional[List[str]] = None,
    image_reuse:       bool = False,
    is_ai_generated:   bool = False,
    is_stock_photo:    bool = False,
    vision_description: str = "",
    doc_flags:         Optional[List[str]] = None,
) -> str:
    prompt = _build_campaign_prompt(
        title, category, amount_eth,
        text_score, semantic_score, amount_score, image_score, document_score,
        trust_score, flags or [], image_reuse, is_ai_generated, is_stock_photo,
        vision_description, doc_flags or [],
    )
    return _call_llm(prompt, max_tokens=250)


# ── Proof explanation ─────────────────────────────────────────────────────────

def _build_proof_prompt(
    milestone_title:   str,
    amount_eth:        float,
    proof_description: str,
    document_names:    List[str],
    campaign_title:    str,
    consistency_score: int,
    flags:             List[str],
) -> str:
    docs     = ", ".join(document_names) if document_names else "no documents submitted"
    flag_str = ", ".join(flags)         if flags          else "none"
    return f"""You are reviewing a withdrawal proof for a crowdfunding milestone.

CAMPAIGN:  "{campaign_title}"
MILESTONE: "{milestone_title}"
AMOUNT:    {amount_eth:.4f} ETH requested
DOCUMENTS: {docs}
CREATOR'S EXPLANATION: "{proof_description}"

CONSISTENCY SCORE: {consistency_score}/100
FLAGS: {flag_str}

Write exactly 2-3 sentences for the platform admin. State whether the proof appears
consistent with the milestone. Note the most important concern if any. Be direct."""


def generate_proof_explanation(
    milestone_title:   str,
    amount_eth:        float,
    proof_description: str,
    document_names:    List[str],
    campaign_title:    str,
    consistency_score: int,
    flags:             List[str],
) -> str:
    prompt = _build_proof_prompt(
        milestone_title, amount_eth, proof_description,
        document_names, campaign_title, consistency_score, flags,
    )
    return _call_llm(prompt, max_tokens=200)


# ── Shared LLM caller ─────────────────────────────────────────────────────────

def _call_llm(prompt: str, max_tokens: int = 200) -> str:
    # Primary: Groq llama-3.3-70b-versatile (best free reasoning model)
    try:
        client   = _get_groq()
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0.25,
        )
        return response.choices[0].message.content.strip()
    except Exception as groq_err:
        print(f"[explainer] Groq failed: {groq_err}")

    # Fallback: Mistral small
    try:
        client   = _get_mistral()
        response = client.chat.complete(
            model="mistral-small-latest",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=max_tokens,
            temperature=0.25,
        )
        return response.choices[0].message.content.strip()
    except Exception as mistral_err:
        print(f"[explainer] Mistral fallback failed: {mistral_err}")

    return "AI explanation unavailable. Review signal scores and flags manually."

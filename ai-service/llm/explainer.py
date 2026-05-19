"""
LLM explanation generation for AI analysis results.

Uses Groq as primary (fast, free, llama-3.1-8b-instant).
Falls back to Mistral if Groq fails.
Returns a plain-English 2-3 sentence admin summary.
"""

from __future__ import annotations

import os
from typing import List

_groq_client = None
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


def _build_campaign_prompt(
    title: str,
    category: str,
    amount_eth: float,
    text_score: int,
    semantic_score: int,
    amount_score: int,
    image_reuse: bool,
    trust_score: int,
    flags: List[str],
) -> str:
    flag_str = ", ".join(flags) if flags else "none"
    return f"""You are a fraud analyst reviewing a crowdfunding campaign for a platform admin.

Campaign: "{title}"
Category: {category}
Requested amount: {amount_eth} ETH

AI Signal Scores (each out of 25):
- Text quality: {text_score}/25
- Uniqueness (no duplicates): {semantic_score}/25
- Amount reasonableness: {amount_score}/25
- Image reuse detected: {"YES — FLAG" if image_reuse else "No"}

Combined trust score: {trust_score}/100
Flags raised: {flag_str}

Write a 2-3 sentence plain-English summary for the admin reviewer. Highlight the most important concern if any, or confirm the campaign appears legitimate. Be direct and factual. Do not use bullet points."""


def _build_proof_prompt(
    milestone_title: str,
    amount_eth: float,
    proof_description: str,
    document_names: List[str],
    campaign_title: str,
    consistency_score: int,
    flags: List[str],
) -> str:
    docs = ", ".join(document_names) if document_names else "no documents listed"
    flag_str = ", ".join(flags) if flags else "none"
    return f"""You are reviewing a withdrawal proof submission for a crowdfunding platform.

Campaign: "{campaign_title}"
Milestone: "{milestone_title}"
Requested amount: {amount_eth} ETH
Creator's explanation: "{proof_description}"
Documents submitted: {docs}
Consistency score: {consistency_score}/100
Issues flagged: {flag_str}

Write a 2-3 sentence review note for the admin. State whether the documents and explanation appear consistent with the milestone. Note any specific concerns. Be direct and factual."""


def generate_campaign_explanation(
    title: str,
    category: str,
    amount_eth: float,
    text_score: int,
    semantic_score: int,
    amount_score: int,
    image_reuse: bool,
    trust_score: int,
    flags: List[str],
) -> str:
    prompt = _build_campaign_prompt(
        title, category, amount_eth,
        text_score, semantic_score, amount_score,
        image_reuse, trust_score, flags
    )
    return _call_llm(prompt)


def generate_proof_explanation(
    milestone_title: str,
    amount_eth: float,
    proof_description: str,
    document_names: List[str],
    campaign_title: str,
    consistency_score: int,
    flags: List[str],
) -> str:
    prompt = _build_proof_prompt(
        milestone_title, amount_eth, proof_description,
        document_names, campaign_title, consistency_score, flags
    )
    return _call_llm(prompt)


def _call_llm(prompt: str) -> str:
    # Try Groq first
    try:
        client = _get_groq()
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as groq_err:
        print(f"[explainer] Groq failed: {groq_err}")

    # Fall back to Mistral
    try:
        client = _get_mistral()
        response = client.chat.complete(
            model="mistral-small-latest",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=200,
            temperature=0.3,
        )
        return response.choices[0].message.content.strip()
    except Exception as mistral_err:
        print(f"[explainer] Mistral fallback failed: {mistral_err}")

    # Graceful degradation — return a minimal summary without LLM
    return "AI explanation unavailable. Please review the signal scores and flags manually."

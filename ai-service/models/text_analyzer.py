"""
Text quality analysis for campaign descriptions.
Scores 0–25 based on: content quality, readability, fraud keyword presence.
"""

from __future__ import annotations

import re
from typing import List, Tuple

import textstat
from sklearn.feature_extraction.text import TfidfVectorizer

# ─── Fraud signal keywords ────────────────────────────────────────────────────
FRAUD_KEYWORDS: List[str] = [
    "urgent", "act now", "limited time", "once in a lifetime",
    "guaranteed", "100% sure", "no risk", "risk free",
    "double your", "triple your", "instant profit",
    "wire transfer", "western union", "money gram",
    "bitcoin", "crypto wallet", "send crypto",
    "god bless", "allah will reward", "prayer request",
    "nigerian prince", "foreign funds", "inheritance",
    "click here", "verify your account", "account suspended",
]

VAGUE_PHRASES: List[str] = [
    "for personal use", "miscellaneous expenses", "various needs",
    "help me", "i need money", "please help", "anything helps",
]

# ─── TF-IDF vectorizer (stateless — used for term extraction only) ────────────
_vectorizer = TfidfVectorizer(max_features=500, stop_words="english")


def analyze_text(title: str, description: str) -> Tuple[int, List[str]]:
    """
    Returns (score: 0-25, flags: List[str])
    """
    flags: List[str] = []
    score = 25  # start full, deduct for issues

    combined = f"{title} {description}".lower()
    word_count = len(description.split())

    # 1. Length check — too short descriptions are a red flag
    if word_count < 30:
        score -= 12
        flags.append("description_too_short")
    elif word_count < 60:
        score -= 6
        flags.append("description_brief")

    # 2. Fraud keyword hits (each unique hit deducts 3, capped at -12)
    fraud_hits = [kw for kw in FRAUD_KEYWORDS if kw in combined]
    deduction = min(len(fraud_hits) * 3, 12)
    if fraud_hits:
        score -= deduction
        flags.append(f"fraud_keywords_detected:{','.join(fraud_hits[:3])}")

    # 3. Vague phrases
    vague_hits = [ph for ph in VAGUE_PHRASES if ph in combined]
    if vague_hits:
        score -= min(len(vague_hits) * 2, 6)
        flags.append("vague_fund_usage")

    # 4. Readability — Flesch-Kincaid grade level
    # Very low grade (< 4) = too simplistic, high (> 16) = suspiciously complex
    try:
        fk_grade = textstat.flesch_kincaid_grade(description)
        if fk_grade < 3:
            score -= 3
            flags.append("very_low_readability")
        elif fk_grade > 18:
            score -= 2
            flags.append("unusually_complex_language")
    except Exception:
        pass

    # 5. All-caps words (shouting / pressure tactics)
    caps_words = re.findall(r'\b[A-Z]{4,}\b', title + " " + description)
    if len(caps_words) > 3:
        score -= 3
        flags.append("excessive_caps_detected")

    # 6. Title contains the description (copy-paste)
    if title.lower().strip() in description.lower():
        score -= 2
        flags.append("title_repeated_in_description")

    return max(score, 0), flags

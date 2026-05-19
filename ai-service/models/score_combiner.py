"""
Combines individual signal scores into a final trust score (0-100).

Weights:
  text_score      (0-25) — description quality
  semantic_score  (0-25) — uniqueness vs. existing campaigns
  amount_score    (0-25) — statistical reasonableness

Plus image_reuse_flag: if True, deducts 25 from the total.

Final = sum(text, semantic, amount) - image_penalty → clamped to [0, 100]
"""

from __future__ import annotations

from typing import List, Tuple


def combine_scores(
    text_score:     int,
    semantic_score: int,
    amount_score:   int,
    image_reuse:    bool,
    all_flags:      List[str],
) -> Tuple[int, str]:
    """
    Returns (final_trust_score: 0-100, risk_level: 'low'|'medium'|'high').
    """
    raw = text_score + semantic_score + amount_score
    penalty = 25 if image_reuse else 0
    final = max(raw - penalty, 0)

    # Normalise from 0-75 range to 0-100
    normalised = int((final / 75) * 100)
    normalised = max(0, min(100, normalised))

    if normalised >= 70:
        risk = "low"
    elif normalised >= 40:
        risk = "medium"
    else:
        risk = "high"

    return normalised, risk

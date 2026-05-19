"""
Combines five signal scores into a final trust score (0-100).

New weights (Version 3):
  text_score      (raw 0-25) → scaled to 0-20
  semantic_score  (raw 0-25) → scaled to 0-15
  amount_score    (raw 0-25) → scaled to 0-15
  image_score     (raw 0-25) → scaled to 0-10
  document_score  (raw 0-40) → used directly

Total = 20 + 15 + 15 + 10 + 40 = 100

Document evidence is the largest single signal (40%) because story-proof alignment
is the hardest to fake and the strongest trust indicator.
"""

from __future__ import annotations

from typing import List, Tuple


def combine_scores(
    text_score:      int,
    semantic_score:  int,
    amount_score:    int,
    image_score:     int,
    document_score:  int,
    all_flags:       List[str],
) -> Tuple[int, str]:
    """
    Returns (final_trust_score: 0-100, risk_level: 'low'|'medium'|'high').

    Each of the first four signals was produced on a 0-25 scale by its module;
    they are scaled down here to their new weight budgets.
    document_score is already in 0-40 range.
    """
    # Scale existing signals to new weights
    adj_text     = round(text_score     * 20 / 25)  # 0-20
    adj_semantic = round(semantic_score * 15 / 25)  # 0-15
    adj_amount   = round(amount_score   * 15 / 25)  # 0-15
    adj_image    = round(image_score    * 10 / 25)  # 0-10
    doc          = max(0, min(40, document_score))  # 0-40

    base = adj_text + adj_semantic + adj_amount + adj_image + doc
    base = max(0, min(100, base))

    # Compound penalty for simultaneous high-risk signals
    high_risk = {
        "near_duplicate_campaign_detected",
        "image_reused_from_existing_campaign",
        "image_possibly_ai_generated",
        "fraud_keywords_detected",
        "document_dated_in_future",
        "no_readable_documents",
    }
    hits = sum(1 for f in all_flags if any(h in f for h in high_risk))
    penalty = min(hits * 3, 12)

    final = max(0, min(100, base - penalty))

    if final >= 70:
        risk = "low"
    elif final >= 40:
        risk = "medium"
    elif final >= 25:
        risk = "medium"   # needs_more_proof band — still medium risk
    else:
        risk = "high"

    return final, risk

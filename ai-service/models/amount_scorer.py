"""
Statistical amount reasonableness scoring.

Compares the requested ETH amount against category baselines.
Uses Z-score: scores 25 for amounts within 1 std dev, scales to 0 for > 3 std devs.

Baselines assume ETH ≈ $3,000 USD (update if ETH price changes significantly).
"""

from __future__ import annotations

import math
from typing import Dict, List, Tuple

# Per-category statistical baselines (in ETH)
# Derived from typical crowdfunding amounts converted at ~$3,000/ETH
BASELINES: Dict[str, Dict[str, float]] = {
    "medical": {
        "mean": 1.5,    # ~$4,500 — surgery deposits, treatment
        "std":  1.2,
        "min":  0.05,
        "max":  15.0,   # ~$45,000 — complex surgeries
    },
    "education": {
        "mean": 0.8,    # ~$2,400 — tuition fees
        "std":  0.6,
        "min":  0.03,
        "max":  5.0,
    },
    "disaster": {
        "mean": 2.0,    # ~$6,000 — rebuilding, displacement
        "std":  1.5,
        "min":  0.1,
        "max":  20.0,
    },
    "community": {
        "mean": 0.5,    # ~$1,500 — local projects
        "std":  0.4,
        "min":  0.02,
        "max":  3.0,
    },
}

DEFAULT_BASELINE = BASELINES["medical"]


def score_amount(amount_eth: float, category: str) -> Tuple[int, List[str]]:
    """
    Returns (score: 0-25, flags: List[str]).
    """
    flags: List[str] = []
    baseline = BASELINES.get(category, DEFAULT_BASELINE)

    # Hard floor / ceiling check
    if amount_eth < baseline["min"]:
        return 5, ["amount_unusually_low"]
    if amount_eth > baseline["max"]:
        return 0, ["amount_extremely_high"]

    z = abs(amount_eth - baseline["mean"]) / baseline["std"]

    if z <= 1.0:
        score = 25
    elif z <= 2.0:
        # Linear: z=1 → 25, z=2 → 15
        score = int(25 - (z - 1.0) * 10)
    elif z <= 3.0:
        # Linear: z=2 → 15, z=3 → 0
        score = int(15 - (z - 2.0) * 15)
    else:
        score = 0
        flags.append("amount_statistical_outlier")

    if z > 2.0 and not flags:
        flags.append("amount_above_typical_range")

    return max(score, 0), flags

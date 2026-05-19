"""
Semantic duplicate detection using sentence-transformers.

Model: all-MiniLM-L6-v2 (22M params, ~80MB, runs on CPU).
Computes cosine similarity between the new campaign and all existing embeddings.
Returns a score 0–25 (25 = fully unique, 0 = near-duplicate).
"""

from __future__ import annotations

from typing import List, Tuple

import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Loaded once at startup — cached in memory between requests
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def encode(text: str) -> List[float]:
    """Return 384-dim embedding for a single text string."""
    model = _get_model()
    embedding = model.encode([text], normalize_embeddings=True)
    return embedding[0].tolist()


def check_semantic_similarity(
    new_text: str,
    existing_embeddings: List[List[float]],
) -> Tuple[int, List[str], List[float]]:
    """
    Returns (score: 0-25, flags: List[str], new_embedding: List[float]).

    - score 25  → no duplicates found (max_similarity < 0.30)
    - score 0   → near-exact duplicate found (max_similarity ≥ 0.90)
    - linear interpolation between those bounds
    """
    model  = _get_model()
    flags: List[str] = []

    new_embedding = model.encode([new_text], normalize_embeddings=True)

    if not existing_embeddings:
        return 25, [], new_embedding[0].tolist()

    existing_matrix = np.array(existing_embeddings, dtype=np.float32)
    similarities    = cosine_similarity(new_embedding, existing_matrix)[0]
    max_sim         = float(similarities.max())

    if max_sim >= 0.90:
        score = 0
        flags.append("near_duplicate_campaign_detected")
    elif max_sim >= 0.75:
        # Scale: 0.75 → 5 pts, 0.90 → 0 pts
        score = int((0.90 - max_sim) / 0.15 * 5)
        flags.append("similar_campaign_exists")
    elif max_sim >= 0.55:
        # Scale: 0.55 → 15 pts, 0.75 → 5 pts
        score = int(5 + (0.75 - max_sim) / 0.20 * 10)
        flags.append("moderately_similar_campaign_found")
    elif max_sim >= 0.30:
        # Scale: 0.30 → 25 pts, 0.55 → 15 pts
        score = int(15 + (0.55 - max_sim) / 0.25 * 10)
    else:
        score = 25

    return max(score, 0), flags, new_embedding[0].tolist()

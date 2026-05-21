"""
Cross-validates entities extracted from a campaign description against uploaded documents.
Includes timeline validation.

align_documents(desc_entities, doc_entities, campaign_created_at) -> (score: 0-40, flags: list[str])
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Optional

from rapidfuzz import fuzz

# Points awarded per matched entity
_WEIGHTS = {
    "patient_name":          5,
    "hospital_name":         5,
    "diagnosis":             5,
    "doctor_name":           3,
    "procedure":             3,
    "city":                  2,
    "local_currency_amount": 4,
    "registration_number":   4,
    "organization_name":     3,
    "school_name":           3,
    "course_name":           2,
}

# Maps description entity keys → possible doc entity keys
_DOC_KEY_MAP: dict[str, list[str]] = {
    "patient_name":          ["patient_name", "student_name"],
    "hospital_name":         ["hospital_name", "issuing_organization"],
    "organization_name":     ["issuing_organization", "hospital_name"],
    "school_name":           ["issuing_organization", "hospital_name"],
    "local_currency_amount": ["amount"],
    "registration_number":   ["registration_number"],
}

_UNUSABLE = {"download_failed", "unsupported_format", "extraction_failed", "unreadable", "pdf_unrendered"}


def _normalize(s) -> str:
    return re.sub(r"\s+", " ", str(s).lower().strip())


def _match(a, b, threshold: int = 80) -> bool:
    an, bn = _normalize(a), _normalize(b)
    return bool(an) and bool(bn) and fuzz.partial_ratio(an, bn) >= threshold


def _doc_candidates(doc: dict, desc_key: str) -> list[str]:
    keys = _DOC_KEY_MAP.get(desc_key, [desc_key])
    return [str(doc[k]) for k in keys if doc.get(k) is not None]


def _timeline_score(
    desc_entities: dict,
    doc_entities: list[dict],
    campaign_created_at: Optional[datetime],
) -> tuple[int, list[str]]:
    """Returns (delta: int, flags: list[str])."""
    if not campaign_created_at:
        return 0, []

    raw = desc_entities.get("date_mentioned")
    if not raw:
        return 0, []

    try:
        import dateparser
        desc_date = dateparser.parse(
            str(raw),
            settings={"RELATIVE_BASE": campaign_created_at, "PREFER_DAY_OF_MONTH": "first"},
        )
    except Exception:
        return 0, ["date_parse_failed"]

    if not desc_date:
        return 0, []

    doc_dates: list[datetime] = []
    for doc in doc_entities:
        raw_d = doc.get("date")
        if raw_d:
            try:
                import dateparser as dp
                p = dp.parse(str(raw_d))
                if p:
                    doc_dates.append(p)
            except Exception:
                pass

    if not doc_dates:
        return 0, []

    # Future-dated document → likely fraud
    if any(d > campaign_created_at + timedelta(days=1) for d in doc_dates):
        return -10, ["document_dated_in_future"]

    min_gap = min(abs((desc_date - d).days) for d in doc_dates)
    if min_gap <= 30:
        return 5, []
    if min_gap > 365:
        return -5, ["timeline_mismatch_major"]
    if min_gap > 90:
        return -2, ["timeline_mismatch_minor"]
    return 0, []


def align_documents(
    desc_entities: dict,
    doc_entities: list[dict],
    campaign_created_at: Optional[datetime] = None,
) -> tuple[int, list[str]]:
    """
    Score how well the uploaded documents corroborate the campaign story.
    Returns (score: 0-40, flags: list[str]).
    """
    flags: list[str] = []

    if not doc_entities:
        flags.append("no_documents_uploaded")
        return 0, flags

    # Separate readable from unusable
    readable = [d for d in doc_entities if d.get("doc_type") not in _UNUSABLE]

    # Base credit for uploading docs (up to +9 for 3 docs)
    base = min(len(doc_entities), 3) * 3

    if not readable:
        flags.append("documents_unreadable")
        return min(5, base), flags

    matched:       set[str] = set()
    contradicted:  set[str] = set()

    for desc_key, weight in _WEIGHTS.items():
        desc_val = desc_entities.get(desc_key)
        if not desc_val:
            continue  # Not claimed → nothing to validate

        found_match = False
        for doc in readable:
            for doc_val in _doc_candidates(doc, desc_key):
                if _match(desc_val, doc_val):
                    if desc_key not in matched:
                        base += weight
                        matched.add(desc_key)
                    found_match = True
                    break
            if found_match:
                break

        # Contradiction: doc mentions a value that doesn't match what was claimed
        if not found_match and desc_key not in contradicted:
            for doc in readable:
                for doc_val in _doc_candidates(doc, desc_key):
                    if doc_val and not _match(desc_val, doc_val, threshold=65):
                        # Only flag if lengths are similar (not just missing data)
                        if len(_normalize(doc_val)) >= max(3, len(_normalize(desc_val)) // 2):
                            contradicted.add(desc_key)
                            base -= 4
                            flags.append(f"contradiction_{desc_key}")
                            break

    # Timeline check
    tl_delta, tl_flags = _timeline_score(desc_entities, readable, campaign_created_at)
    base += tl_delta
    flags.extend(tl_flags)

    if not matched and readable:
        flags.append("no_entity_matches_found")

    return max(0, min(40, base)), flags

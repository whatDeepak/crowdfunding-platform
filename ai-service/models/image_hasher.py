"""
Image analysis: perceptual hash (duplicate detection) + Groq Vision (authenticity/deepfake).

Signal 4 of the AI pipeline — returns image_score 0-25.

pHash (imagehash):        catches visually reused images (hamming distance ≤ 10)
Groq Vision (llama-4):    relevance to campaign + AI-generated / deepfake / stock-photo flags
"""

from __future__ import annotations

import base64
import json
import os
from dataclasses import dataclass, field
from io import BytesIO
from typing import List, Optional

import httpx
import imagehash
from PIL import Image

SIMILARITY_THRESHOLD = 10  # pHash Hamming distance for "reused" image


# ── Result type ───────────────────────────────────────────────────────────────

@dataclass
class ImageAnalysisResult:
    image_score:       int          # 0-25 for score_combiner
    image_reuse_flag:  bool         # pHash match against existing campaigns
    is_ai_generated:   bool         # Groq Vision verdict
    is_stock_photo:    bool
    is_relevant:       bool
    vision_description: str
    flags:             List[str] = field(default_factory=list)


_NEUTRAL = ImageAnalysisResult(
    image_score=12,
    image_reuse_flag=False,
    is_ai_generated=False,
    is_stock_photo=False,
    is_relevant=True,
    vision_description="",
)


# ── pHash helpers ─────────────────────────────────────────────────────────────

def _fetch_image_bytes(url: str) -> bytes:
    r = httpx.get(url, timeout=15, follow_redirects=True)
    r.raise_for_status()
    return r.content


def compute_phash(image_url: str) -> Optional[str]:
    try:
        img = Image.open(BytesIO(_fetch_image_bytes(image_url)))
        return str(imagehash.phash(img))
    except Exception as exc:
        print(f"[image_hasher] pHash failed: {exc}")
        return None


def check_image_reuse(new_phash: str, existing_phashes: List[str]) -> bool:
    try:
        new_hash = imagehash.hex_to_hash(new_phash)
        for existing in existing_phashes:
            try:
                if abs(new_hash - imagehash.hex_to_hash(existing)) <= SIMILARITY_THRESHOLD:
                    return True
            except Exception:
                continue
        return False
    except Exception:
        return False


# ── Groq Vision analysis ──────────────────────────────────────────────────────

_VISION_PROMPT = """\
You are an AI fraud analyst reviewing a crowdfunding campaign image.
Campaign title: "{title}"
Campaign category: {category}

Analyze the image and respond ONLY in this exact JSON format (no markdown, no explanation):
{{
  "relevance_score": <int 0-10, how relevant this image is to the campaign description>,
  "authenticity_score": <int 0-10, how authentic/genuine the photo appears (10=clearly real, 0=AI-generated or fake)>,
  "is_ai_generated": <true|false>,
  "is_stock_photo": <true|false, generic stock imagery not specific to this person/situation>,
  "is_manipulated": <true|false, obvious editing, composite, or tampering>,
  "description": "<one sentence: what is actually in the image>"
}}"""


def _call_groq_vision(
    img_bytes: bytes,
    content_type: str,
    title: str,
    category: str,
) -> dict:
    from groq import Groq
    client = Groq(api_key=os.getenv("GROQ_API_KEY", ""))

    b64 = base64.b64encode(img_bytes).decode()
    data_url = f"data:{content_type};base64,{b64}"

    prompt = _VISION_PROMPT.format(title=title, category=category)

    completion = client.chat.completions.create(
        model="meta-llama/llama-4-scout-17b-16e-instruct",
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": data_url}},
                {"type": "text", "text": prompt},
            ],
        }],
        max_tokens=300,
        temperature=0.1,
        response_format={"type": "json_object"},
    )
    raw = completion.choices[0].message.content or "{}"
    return json.loads(raw)


# ── Main entry point ──────────────────────────────────────────────────────────

def analyze_image(
    image_url: str,
    title: str,
    category: str,
    existing_phashes: List[str],
) -> ImageAnalysisResult:
    """
    Full image analysis: pHash duplicate check + Groq Vision authenticity.

    Scoring breakdown (0-25):
      relevance  0-10
      authenticity 0-10
      bonus +5 if both ≥ 7 (clearly real, relevant photo)
      -25 if pHash reuse detected (overrides everything → score = 0)
    """
    flags: List[str] = []

    # Step 1 — download image once, share bytes for pHash + Vision
    try:
        response = httpx.get(image_url, timeout=15, follow_redirects=True)
        response.raise_for_status()
        img_bytes = response.content
        content_type = response.headers.get("content-type", "image/jpeg").split(";")[0]
    except Exception as exc:
        print(f"[image_hasher] Image fetch failed: {exc}")
        return _NEUTRAL

    # Step 2 — pHash duplicate check
    image_reuse = False
    try:
        img = Image.open(BytesIO(img_bytes))
        phash_str = str(imagehash.phash(img))
        image_reuse = check_image_reuse(phash_str, existing_phashes)
        if image_reuse:
            flags.append("image_reused_from_existing_campaign")
    except Exception as exc:
        print(f"[image_hasher] pHash error: {exc}")

    # Step 3 — Groq Vision analysis
    vision: dict = {}
    try:
        if os.getenv("GROQ_API_KEY"):
            vision = _call_groq_vision(img_bytes, content_type, title, category)
        else:
            print("[image_hasher] GROQ_API_KEY not set — skipping vision analysis")
    except Exception as exc:
        print(f"[image_hasher] Vision analysis failed: {exc}")

    relevance     = min(max(int(vision.get("relevance_score", 5)), 0), 10)
    authenticity  = min(max(int(vision.get("authenticity_score", 5)), 0), 10)
    is_ai         = bool(vision.get("is_ai_generated", False))
    is_stock      = bool(vision.get("is_stock_photo", False))
    is_manipulated= bool(vision.get("is_manipulated", False))
    description   = str(vision.get("description", ""))

    if is_ai:
        flags.append("image_possibly_ai_generated")
    if is_stock:
        flags.append("image_appears_to_be_stock_photo")
    if is_manipulated:
        flags.append("image_shows_signs_of_manipulation")
    if relevance < 4:
        flags.append("image_not_relevant_to_campaign")

    # Step 4 — compute image_score (0-25)
    if image_reuse:
        # Reused image is an immediate trust killer
        image_score = 0
    else:
        image_score = relevance + authenticity
        if relevance >= 7 and authenticity >= 7:
            image_score = min(image_score + 5, 25)
        image_score = min(image_score, 25)

    return ImageAnalysisResult(
        image_score=image_score,
        image_reuse_flag=image_reuse,
        is_ai_generated=is_ai,
        is_stock_photo=is_stock,
        is_relevant=relevance >= 5,
        vision_description=description,
        flags=flags,
    )


def no_image_result() -> ImageAnalysisResult:
    """Returned when campaign has no image — neutral penalty."""
    return ImageAnalysisResult(
        image_score=10,  # slight penalty for no image
        image_reuse_flag=False,
        is_ai_generated=False,
        is_stock_photo=False,
        is_relevant=False,
        vision_description="",
        flags=["no_campaign_image_provided"],
    )

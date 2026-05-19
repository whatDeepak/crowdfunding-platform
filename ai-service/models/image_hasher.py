"""
Perceptual image hashing for campaign cover image duplicate detection.

Uses pHash (DCT-based perceptual hash) from the imagehash library.
A Hamming distance ≤ 10 between two pHashes means the images are visually similar.
"""

from __future__ import annotations

from io import BytesIO
from typing import List

import httpx
import imagehash
from PIL import Image

SIMILARITY_THRESHOLD = 10  # pHash Hamming distance


def _fetch_image(url: str) -> Image.Image:
    response = httpx.get(url, timeout=10, follow_redirects=True)
    response.raise_for_status()
    return Image.open(BytesIO(response.content))


def compute_phash(image_url: str) -> str | None:
    """
    Downloads image from URL and returns its pHash hex string.
    Returns None if the image cannot be fetched or hashed.
    """
    try:
        img = _fetch_image(image_url)
        return str(imagehash.phash(img))
    except Exception as exc:
        print(f"[image_hasher] Could not hash {image_url}: {exc}")
        return None


def check_image_reuse(new_phash: str, existing_phashes: List[str]) -> bool:
    """
    Returns True if new_phash is within SIMILARITY_THRESHOLD of any existing hash.
    """
    try:
        new_hash = imagehash.hex_to_hash(new_phash)
        for existing in existing_phashes:
            try:
                existing_hash = imagehash.hex_to_hash(existing)
                if abs(new_hash - existing_hash) <= SIMILARITY_THRESHOLD:
                    return True
            except Exception:
                continue
        return False
    except Exception:
        return False

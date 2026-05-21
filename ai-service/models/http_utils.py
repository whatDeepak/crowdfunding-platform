"""Retry-aware HTTP fetch helper shared across all model modules."""
from __future__ import annotations

import time
from typing import Optional

import httpx


def fetch_with_retry(
    url: str,
    timeout: float = 20.0,
    max_retries: int = 2,
) -> Optional[httpx.Response]:
    """GET url with exponential backoff. Returns None on final failure."""
    for attempt in range(max_retries + 1):
        try:
            with httpx.Client(timeout=timeout, follow_redirects=True) as client:
                resp = client.get(url)
                resp.raise_for_status()
                return resp
        except Exception as exc:
            if attempt == max_retries:
                print(f"[http_utils] Failed after {max_retries + 1} attempts: {url} — {exc}")
                return None
            time.sleep(1.5 ** attempt)
    return None

"""
Entity extraction from campaign descriptions and uploaded documents.

  extract_description_entities() — Groq LLM structured extraction from text
  extract_document_entities()    — Groq Vision OCR + extraction from IPFS doc (image or PDF)
"""

from __future__ import annotations

import base64
import io
import json
import os
import re
from typing import Optional, Tuple

from .http_utils import fetch_with_retry

GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
PINATA_GATEWAY = os.getenv("PINATA_GATEWAY_URL", "https://gateway.pinata.cloud/ipfs")

_SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}

_DESCRIPTION_SYSTEM = """Extract structured entities from a crowdfunding campaign description.
Return ONLY a valid JSON object with exactly these keys (null if not mentioned):
{
  "patient_name": null,
  "doctor_name": null,
  "hospital_name": null,
  "diagnosis": null,
  "procedure": null,
  "city": null,
  "district": null,
  "date_mentioned": null,
  "local_currency_amount": null,
  "registration_number": null,
  "organization_name": null,
  "school_name": null,
  "course_name": null,
  "student_name": null
}
Extract only EXPLICITLY stated values. Do NOT infer or guess."""

_DOCUMENT_USER = """Identify the type of this document and extract key information.
Return ONLY a valid JSON object:
{
  "doc_type": "medical_record|prescription|invoice|receipt|certificate|admission_letter|discharge_summary|id_proof|other|unreadable",
  "patient_name": null,
  "doctor_name": null,
  "hospital_name": null,
  "diagnosis": null,
  "procedure": null,
  "date": null,
  "amount": null,
  "registration_number": null,
  "issuing_organization": null,
  "city": null,
  "course_name": null,
  "student_name": null
}
If the image is blank, blurry, or not a relevant document, set doc_type to "unreadable"."""


def _fetch_and_prepare_image(cid: str) -> Tuple[Optional[bytes], Optional[str]]:
    """
    Fetch IPFS document and return (image_bytes, mime_type).
    Handles: JPEG/PNG/WebP (pass through), PDF (render first page as PNG).
    Returns (None, None) on fetch failure or unsupported format.
    """
    url = f"{PINATA_GATEWAY}/{cid}"
    resp = fetch_with_retry(url)
    if resp is None:
        print(f"[entity_extractor] Download failed for {cid}")
        return None, None

    content_type = resp.headers.get("content-type", "").split(";")[0].strip().lower()

    if content_type in _SUPPORTED_IMAGE_TYPES:
        return resp.content, content_type

    if content_type == "application/pdf":
        try:
            from pdf2image import convert_from_bytes
            pages = convert_from_bytes(resp.content, first_page=1, last_page=1, fmt="png", dpi=150)
            buf = io.BytesIO()
            pages[0].save(buf, format="PNG")
            return buf.getvalue(), "image/png"
        except Exception as exc:
            print(f"[entity_extractor] PDF conversion failed for {cid}: {exc}")
            # Return sentinel so caller can give partial credit for uploading a PDF
            return b"", "application/pdf"

    print(f"[entity_extractor] Unsupported content-type for {cid}: {content_type}")
    return None, None


def _groq_text(system: str, user: str) -> Optional[dict]:
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
            max_tokens=350,
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content.strip())
    except Exception as exc:
        print(f"[entity_extractor] Groq text failed: {exc}")
        return None


def _groq_vision(image_b64: str, mime: str) -> Optional[dict]:
    try:
        from groq import Groq
        client = Groq(api_key=GROQ_API_KEY)
        resp = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{image_b64}"},
                    },
                    {"type": "text", "text": _DOCUMENT_USER + "\n\nReturn ONLY the JSON, no markdown."},
                ],
            }],
            max_tokens=400,
            temperature=0.0,
        )
        raw = resp.choices[0].message.content.strip()
        raw = re.sub(r"^```json\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        return json.loads(raw)
    except Exception as exc:
        print(f"[entity_extractor] Groq Vision failed: {exc}")
        return None


def extract_description_entities(description: str, title: str = "", category: str = "") -> dict:
    """Extract named entities from campaign description text via Groq LLM."""
    user = f"Title: {title}\nCategory: {category}\nDescription:\n{description}"
    return _groq_text(_DESCRIPTION_SYSTEM, user) or {}


def extract_document_entities(ipfs_cid: str) -> dict:
    """
    Fetch document from IPFS gateway and extract entities via Groq Vision.
    Supports JPEG, PNG, WebP, and PDF (first page converted to PNG).
    """
    img_bytes, mime = _fetch_and_prepare_image(ipfs_cid)

    if img_bytes is None:
        return {"doc_type": "download_failed"}

    # PDF conversion succeeded but returned empty bytes (poppler not installed)
    if mime == "application/pdf" and not img_bytes:
        print(f"[entity_extractor] PDF uploaded but could not be rendered — granting partial credit")
        return {"doc_type": "pdf_unrendered"}

    b64 = base64.b64encode(img_bytes).decode("utf-8")
    result = _groq_vision(b64, mime)
    return result or {"doc_type": "extraction_failed"}

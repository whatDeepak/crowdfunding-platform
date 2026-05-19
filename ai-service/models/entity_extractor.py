"""
Entity extraction from campaign descriptions and uploaded documents.

  extract_description_entities() — Groq LLM structured extraction from text
  extract_document_entities()    — Groq Vision OCR + extraction from IPFS image
"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Optional

import httpx

GROQ_API_KEY    = os.getenv("GROQ_API_KEY", "")
PINATA_GATEWAY  = os.getenv("PINATA_GATEWAY_URL", "https://gateway.pinata.cloud/ipfs")

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

_SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}


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
    except Exception as e:
        print(f"[entity_extractor] Groq text failed: {e}")
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
    except Exception as e:
        print(f"[entity_extractor] Groq Vision failed: {e}")
        return None


def extract_description_entities(description: str, title: str = "", category: str = "") -> dict:
    """Extract named entities from campaign description text via Groq LLM."""
    user = f"Title: {title}\nCategory: {category}\nDescription:\n{description}"
    return _groq_text(_DESCRIPTION_SYSTEM, user) or {}


def extract_document_entities(ipfs_cid: str) -> dict:
    """
    Fetch document from IPFS gateway and extract entities via Groq Vision.
    Only image formats are processed; PDFs return {'doc_type': 'unsupported_format'}.
    """
    url = f"{PINATA_GATEWAY}/{ipfs_cid}"
    try:
        r = httpx.get(url, timeout=20, follow_redirects=True)
        r.raise_for_status()
    except Exception as e:
        print(f"[entity_extractor] Download failed for {ipfs_cid}: {e}")
        return {"doc_type": "download_failed"}

    content_type = r.headers.get("content-type", "").split(";")[0].strip().lower()
    if content_type not in _SUPPORTED_IMAGE_TYPES:
        return {"doc_type": "unsupported_format", "_content_type": content_type}

    b64 = base64.b64encode(r.content).decode("utf-8")
    result = _groq_vision(b64, content_type)
    return result or {"doc_type": "extraction_failed"}

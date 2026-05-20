---
title: Crowdfunding AI Service
emoji: 🛡️
colorFrom: blue
colorTo: indigo
sdk: docker
pinned: false
---

# Crowdfunding AI Service

FastAPI service for the AI-Assisted Transparent Crowdfunding Platform.

## Endpoints

- `GET /health` — warm-up endpoint (pre-loads MiniLM model, call this before demo)
- `POST /analyze-campaign` — 5-signal trust score pipeline
- `POST /analyze-proof` — withdrawal proof consistency check

## Environment Variables (set in HF Space secrets)

- `GROQ_API_KEY` — required for LLM explanation and document OCR
- `MISTRAL_API_KEY` — optional fallback LLM

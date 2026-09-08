---
name: week-9-ai-coaching-rag
description: Delivered the full AI Coaching RAG workflow, curated biomechanics knowledge base, vector retriever, LLM and deterministic fallback service, interactive coaching UI, and 151 passing automated tests.
metadata:
  type: project
---

# Week 9 Implementation Summary: AI Coaching RAG Workflow

## 1. Core Objectives Delivered
- **Curated Biomechanics Knowledge Base & Hybrid Vector Retriever:**
  - Authored `backend/app/knowledge/knowledge_base.json` covering 8 evidence-based domains: squat depth & femur ratios, torso lean & 360° intra-abdominal bracing, knee valgus & glute medius activation, tempo & eccentric control, mobility warmups, corrective exercise variations, progressive overload, and safety boundaries.
  - Built `backend/app/knowledge/retriever.py` with TF-IDF vector indexing and cosine similarity search. Employs query expansion on detected issue codes (`torso_lean`, `depth`, `knee_valgus`, `tempo`), severity weighting, and calibrated relevance scores (0.0 to 1.0).
- **AI Coaching Service Layer (`backend/app/services/coaching.py`):**
  - Implemented `analyze_session_coaching` endpoint logic.
  - Implemented Google Gemini LLM API integration with structured JSON schema output and strict prompt guardrails.
  - Enforced a zero-failure **deterministic rule-based fallback generator** as required by `AI_COACHING_RAG.md` whenever external LLM APIs are offline or unconfigured.
  - Guaranteed conservative coaching: no medical/injury diagnosis, no invented metrics, maximum 3 actionable recommendations, and mandatory safety disclaimer.
- **FastAPI Coaching Endpoint (`backend/app/routers/coaching.py`):**
  - Exposed `POST /api/coaching/analyze` conforming strictly to the contract in `AI_COACHING_RAG.md`.
  - Automatically fetches and injects the authenticated athlete's `UserBaseline` (femur/torso, shin/torso, bottom knee angle, typical torso lean) when not explicitly passed in the request body.
- **Interactive Coaching UI (`frontend/src/components/SessionSummaryModal.jsx`):**
  - Embedded an **AI Biomechanics Coach** section inside the workout summary review modal.
  - Displays primary technique flaw badge, natural-language explanation grounded in calibrated baseline angles, up to 3 prioritized corrective drill cards, next session target goal, and an expandable retrieved guidance evidence accordion showing source IDs, titles, and match percentages.
- **Dashboard Coaching Focus (`frontend/src/components/DashboardView.jsx`):**
  - Added an **AI Coaching Focus** card highlighting the athlete's most frequent technique flaw and recommended corrective drills.
- **Production Asset Optimization:**
  - Dynamically imported ground-truth test fixtures in `CalibrationView.jsx` to prevent bundle bloat, keeping the main production JS bundle lean at 374 KB.

## 2. Test Verification
- **Total Automated Tests:** **151 passing** across the entire repository:
  - **79 Vitest unit tests** (18 test suites, including `coachingApi.test.js` and `SessionSummaryModal.test.jsx`).
  - **15 Playwright E2E browser tests** (8 test suites, with backend server integrated via `webServer`).
  - **57 Pytest backend tests** (7 test suites, including `test_knowledge_retriever.py` and `test_coaching.py`).
- **Production Bundle:** Clean Vite production build in ~650ms.

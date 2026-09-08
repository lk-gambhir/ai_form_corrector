# AI-Powered Squat Form Analyzer

A real-time, privacy-first web application for **squat form analysis and biomechanical coaching**. The application runs **MediaPipe Pose** entirely on-device inside the user's browser (no video stream ever leaves the machine), tracks 33 anatomical landmarks, checks kinematics against biomechanical rules, delivers instant visual cues, and logs structured workout sessions to a FastAPI backend.

> ⚠️ **Not a medical device.** This is a heuristic training-feedback tool, not a substitute for professional coaching or medical diagnosis.

---

## Key Features

- **Google OAuth Authentication Gate:** Protected athlete portal requiring Google OAuth authentication (`LoginPage.jsx`). Unauthenticated users cannot access camera or workout views.
- **Real-Data-Only Biomechanics:** Zero synthetic or dummy data.
  - **Live Camera Calibration:** Calibrates limb ratios (femur-to-torso, shin-to-torso) and range of motion (standing vs. bottom inflection) directly from the user's webcam using MediaPipe.
  - **Live Kinematics:** Joint angles computed via 2D dot products from real detected body landmarks.
  - **Cloud Session Analytics:** Dashboard computes real historical aggregates and technique flaw tallies from SQLite; shows clean empty states when no sessions exist.
- **Modular Component Architecture:**
  - Dedicated pages: `LoginPage.jsx`, `WorkoutPage.jsx`, `CalibrationPage.jsx`, and `DashboardPage.jsx`.
  - Layout components: `Navbar.jsx` with athlete status and navigation tabs, `Footer.jsx` with medical disclaimer.
  - Bespoke UI icons: Clean SVG iconography in `Icons.jsx`.
- **Privacy by Design:** Zero video or image telemetry is ever transmitted to or stored on the backend. Only lightweight numerical session metrics (reps, duration, form score, issue codes) are saved.
- **AI Coaching Layer (RAG Grounded):** Structured workout metrics and personalized calibration values are evaluated by a retrieval-augmented coaching service (`POST /api/coaching/analyze`). The LLM synthesizes detected issues, calibrated body proportions, and approved exercise guidance into root-cause explanations and corrective drills; it does not calculate angles or count reps. Includes a zero-failure deterministic fallback when offline.
- **Personalized Biomechanics:** Calibration measures individual limb proportions (femur-to-torso, shin-to-torso) and standing/bottom range-of-motion angles so form thresholds and coaching feedback are adapted to the individual athlete.

---

## Current Status & Test Suite

- **Automated Tests:** **151 total tests** passing (100% green) across the codebase:
  - **79 Vitest Unit Tests** (18 test suites covering angle math, state machine, rules, smoothing, API clients, and AI coaching UI).
  - **15 Playwright Browser E2E Tests** (8 test suites covering Google OAuth gate, live camera, calibration wizard, session flow, and dashboard).
  - **57 Pytest Backend Tests** (7 test suites covering auth, sessions, form score validation, calibration, knowledge retriever, and AI coaching service).
- **Production Build:** Clean bundle via Vite (`npm --workspace frontend run build`) in 656ms with code-split lazy chunks.
- **GitHub Repository:** Attached to `https://github.com/lk-gambhir/ai_form_corrector.git` (weekly progression committed with author Lakshay Gambhir).

---

## Architecture Overview

```
shared/exercise-config/   Biomechanical configuration & joint definitions (squat.config.js)
frontend/src/pages/       Modular page views (LoginPage, WorkoutPage, CalibrationPage, DashboardPage)
frontend/src/components/  Live camera viewport, calibration wizard, coaching summary modal, dashboard
frontend/src/context/     Google OAuth authentication provider (AuthContext.jsx)
frontend/src/pose/        MediaPipe PoseLandmarker wrapper, 2D angle math, EMA smoother
frontend/src/pipeline/    Live video analysis orchestrator and replay frame sources
frontend/src/fixtures/    Real CC-BY squat landmark recordings (ground truth verification)
backend/app/knowledge/   Approved biomechanics knowledge base (JSON) and TF-IDF vector retriever
backend/app/services/     Form score validation, metric aggregation, AI coaching orchestrator
backend/app/routers/      FastAPI routers: auth, sessions, calibration, dashboard, coaching, health
AI_COACHING_RAG.md        LLM coaching, RAG, privacy, and personalized biomechanics design
```

---

## Quick Start

### 1. Setup & Dependencies

```bash
# Install frontend dependencies
npm install

# Download the MediaPipe pose model into frontend public directory
curl -L -o frontend/public/models/pose_landmarker_lite.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task

# Setup backend Python virtual environment
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ..
```

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env.local`. Set the same Google Web Client ID in both files. Configure the OAuth client with `http://localhost:5173` as an authorized JavaScript origin. Set a strong `APP_JWT_SECRET` before using `APP_ENVIRONMENT=production`; the backend rejects the development secret in production.

### 2. Running Locally

Start backend server:
```bash
backend/.venv/bin/uvicorn app.main:app --port 8000
```

Start frontend server (in another terminal):
```bash
npm --workspace frontend run dev
```

Open `http://localhost:5173` in your browser.

Google sign-in uses Google Identity Services and requires a real ID token. The frontend no longer accepts an email-only login or placeholder token.

### 3. Running Automated Tests

```bash
# Run Vitest unit tests
npm --workspace frontend test -- --run

# Run Playwright E2E browser tests
npm --workspace frontend run e2e

# Run Pytest backend test suite
backend/.venv/bin/pytest backend/app/tests
```

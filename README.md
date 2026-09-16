# FormGuard AI

FormGuard AI is a real-time squat-form analysis and biomechanics coaching system. It uses an in-browser camera feed and MediaPipe Pose Landmarker to track 33 body landmarks, calculate joint angles, detect repetitions, evaluate technique, and provide corrective coaching cues.

> **Disclaimer:** FormGuard AI is an exercise-assistance tool, not a medical device. It does not diagnose injuries or replace a qualified coach or healthcare professional.

---

## Key Features & Architecture

```text
Webcam Frame
  ↓
MediaPipe Pose Landmarker (33 landmarks)
  ↓
EMA Landmark Smoothing & Angle Calculation
  ↓
Squat State Machine (Repetition Detection)
  ↓
Form Rule & Metrics Evaluation (Depth, Torso, Tempo)
  ↓
Live Feedback HUD & Session Summary
  ↓
FastAPI Backend & SQLite Storage
  ↓
User Calibration Baseline & RAG AI Coaching
```

- **Client-Side Privacy:** Computer-vision analysis runs entirely in the browser. Only structured numerical metrics (reps, durations, angles, scores) are sent to the backend. Video frames never leave the device.
- **Noise Reduction:** Temporal Exponential Moving Average (EMA) smoothing filters raw landmark jitter before angles are computed.
- **Hysteresis Rep Counting:** State machine (`STANDING → DESCENDING → BOTTOM → ASCENDING → STANDING`) prevents premature, double, or incomplete rep counts.
- **Personalized Baseline:** Extracts user-specific limb proportions (femur-to-torso, shin-to-torso) to tailor feedback beyond fixed universal thresholds.
- **Grounded AI Coaching:** Biomechanics guidance retrieved via an in-memory TF-IDF index over an authoritative knowledge base, fed to Gemini (with a deterministic rule-based fallback).

---

## Main Components

### Frontend (React + Vite)
- In-browser camera capture via `getUserMedia` and MediaPipe Tasks Vision.
- 2D joint-angle calculations (hip, knee, ankle, torso lean).
- Repetition state machine and form metrics engine (duration, ROM, descent/ascent tempo ratio).
- Real-time canvas skeleton HUD and debounced feedback cues.
- Calibration wizard and workout analytics dashboard.

### Backend (FastAPI + SQLite + SQLAlchemy)
- Google OAuth token verification and JWT session management.
- User-isolated workout sessions, reps, and form issues persistence.
- Server-side form score verification and summary aggregations.
- Personal calibration storage and retrieval-augmented coaching service (`POST /api/coaching/analyze`).

### Shared Configuration (`shared/exercise-config/`)
- Centralized definitions for landmark indexes, squat thresholds, cue strings, and scoring weights ensuring frontend and backend consistency.

---

## Repetition & Form Analysis

A repetition follows a strict finite state machine:

```text
STANDING → DESCENDING → BOTTOM → ASCENDING → STANDING
```

- **Repetition Commitment:** Only committed when returning fully to the standing state (`knee_angle > up_threshold`).
- **Rep Metrics:** Computes duration, Range of Motion (ROM = peak angle − min angle), and tempo (`descent_duration / ascent_duration`).
- **Feedback Selector:** Prioritizes failed rules by severity (high > medium > low) and debounces cues for 1.5s to prevent visual flickering.

---

## Backend Data Model

```text
User ──── 1:N ──── Session ──── 1:N ──── Rep
                     │
                     └──────── 1:N ──── FormIssue
```

- **User:** Authentication identity and profile metadata.
- **Session:** Exercise type, start/end timestamps, rep count, verified form score.
- **Rep:** Rep number, duration, ROM, tempo ratio, and minimum/peak angles.
- **FormIssue:** Issue code (e.g. `depth`, `torso_lean`), severity, and associated rep.
- **UserBaseline:** Personal limb ratios and angle statistics from calibration.

---

## Personal Calibration & RAG Coaching

1. **Calibration:** Records femur-to-torso, shin-to-torso ratios, and baseline ROM to detect fatigue and technique breakdown.
2. **Retrieval-Augmented Generation (RAG):**
   - The knowledge base (`backend/app/knowledge/knowledge_base.json`) contains curated biomechanics guidance across core movement domains.
   - An in-memory TF-IDF cosine-similarity retriever extracts relevant guidance matching the user's specific form issues.
   - The LLM receives the retrieved guidance and personal baseline to produce targeted, safe recommendations (maximum 3, strict non-medical guardrails).
   - If offline or unconfigured, deterministic rule-based coaching serves as an immediate fallback.

---

## Project Structure

```text
frontend/                 # React application, camera pipeline, HUD, dashboard
backend/                  # FastAPI service, database models, coaching RAG
shared/exercise-config/   # Centralized squat rules, thresholds, and cues
data/                     # Video sources and project assets
journals/                 # Team weekly development journals
```

---

## Setup & Execution

### 1. Frontend
```bash
npm install
npm --workspace frontend run dev
```
Accessible at: **http://localhost:5173**

### 2. Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
Interactive API Docs: **http://127.0.0.1:8000/docs**

---

## Limitations

- Optimized for a side-view camera angle with clear full-body visibility.
- Movement analysis currently computes 2D projection geometry.
- AI coaching provides educational feedback and does not replace medical advice.
- Squats are currently implemented; deadlift and bench press are planned extensions.

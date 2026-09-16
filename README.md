# FormGuard AI

FormGuard AI is a real-time squat-form analysis and biomechanics coaching system. It uses a browser camera and MediaPipe Pose Landmarker to track body landmarks, calculate joint angles, detect squat repetitions, evaluate form, and provide corrective feedback.

The project is designed as an exercise-assistance tool. It is not a medical device and does not diagnose injuries or replace a qualified coach or healthcare professional.

## Project Goals

The system is designed to:

- Detect a user’s body landmarks from webcam video.
- Calculate squat-related joint angles.
- Reduce landmark noise through temporal smoothing.
- Verify that the user is performing a squat-like movement.
- Count completed squat repetitions.
- Evaluate depth, torso position, and movement metrics.
- Display real-time feedback while the user exercises.
- Store structured workout summaries for later review.
- Create a personal movement baseline through calibration.
- Provide retrieval-grounded AI coaching with a deterministic fallback.

The current implementation focuses on squats. Deadlift and bench-press analysis are future extensions.

## Architecture

```text
Webcam
  ↓
MediaPipe Pose Landmarker
  ↓
33 body landmarks
  ↓
Angle calculation and smoothing
  ↓
Squat state machine
  ↓
Repetition and form analysis
  ↓
Live feedback and session summary
  ↓
FastAPI backend and SQLite database
  ↓
Dashboard, calibration, and AI coaching
```

The computer-vision analysis runs in the browser. The backend receives structured numerical results such as repetitions, durations, scores, metrics, and issue codes. Webcam video and image frames are not uploaded or stored by the backend.

## Main Components

### Frontend

The frontend is a React and Vite application.

It contains:

- Camera capture using the browser `getUserMedia` API.
- MediaPipe Pose Landmarker integration.
- 2D joint-angle calculations.
- Landmark smoothing and visibility handling.
- Squat repetition state machine.
- Depth, torso, knee, and tempo analysis.
- Canvas-based skeleton and feedback rendering.
- Calibration workflow.
- Workout history and dashboard views.
- API clients for authentication, sessions, calibration, dashboard data, and coaching.

### Backend

The backend uses FastAPI, SQLAlchemy, SQLite, and Pydantic.

It is responsible for:

- API routing and request validation.
- Google OAuth verification and JWT sessions.
- User-specific data isolation.
- Workout-session persistence.
- Repetition and form-issue persistence.
- Server-side form-score verification.
- Dashboard summaries and trends.
- Personal calibration storage.
- RAG-based coaching and deterministic fallback coaching.

### Shared Configuration

The `shared/exercise-config` directory contains squat-specific definitions shared by the analysis system, including:

- Landmark indexes.
- Rule identifiers.
- Squat thresholds.
- Feedback cues.
- Score weights.
- Shared data-shape documentation.

Keeping these values centralized reduces disagreement between the frontend analysis and backend validation.

## Squat Analysis Pipeline

Each camera frame follows this process:

```text
Camera frame
  ↓
Pose landmarks
  ↓
Visibility checks
  ↓
EMA landmark smoothing
  ↓
Joint-angle calculation
  ↓
Exercise verification
  ↓
Squat state transition
  ↓
Rep completion
  ↓
Form rules and metrics
  ↓
Feedback selection
```

The repetition detector uses a state machine:

```text
STANDING → DESCENDING → BOTTOM → ASCENDING → STANDING
```

A repetition is committed only after the user returns to the standing state. This prevents incomplete movements from being counted as completed repetitions.

Repetition detection and form evaluation are separate. A shallow squat may count as a completed movement while still receiving a depth warning.

## Metrics

For each completed repetition, the system can store:

- Rep number.
- Rep duration.
- Range of motion.
- Tempo ratio.
- Minimum and peak knee angles.
- Torso-angle measurements.
- Detected form issues.

Tempo is calculated as the descent duration divided by the ascent duration:

```text
tempo = descent duration / ascent duration
```

## Backend Data Model

The backend stores structured records instead of video.

```text
User
├── id
├── username
├── email
├── display_name
└── created_at

Session
├── id
├── user_id
├── exercise
├── started_at
├── ended_at
├── duration_seconds
├── rep_count
├── form_score
└── created_at

Rep
├── id
├── session_id
├── rep_number
├── duration_seconds
├── rom_value
├── tempo
└── angle_metrics

FormIssue
├── id
├── session_id
├── rep_number
├── issue_type
└── severity
```

The database relationships are:

```text
User 1 ──── many Session
Session 1 ──── many Rep
Session 1 ──── many FormIssue
```

The backend validates relationships such as matching repetition counts, sequential repetition numbers, valid timestamps, and issues that refer to existing repetitions.

## Personal Calibration

Calibration creates a user-specific movement baseline. It can include:

- Femur-to-torso ratio.
- Shin-to-torso ratio.
- Standing and bottom knee angles.
- Range-of-motion statistics.
- Typical torso lean.
- Angle means and standard deviations.

Future measurements can be compared with this baseline instead of relying only on one universal threshold. The baseline is also supplied to the coaching service for personalized explanations.

## RAG Coaching

The coaching system uses retrieval-augmented generation:

```text
Detected squat issue
  ↓
Query construction
  ↓
TF-IDF retrieval from approved guidance
  ↓
Personal baseline and session metrics
  ↓
Gemini coaching or deterministic fallback
```

The knowledge base is stored in:

```text
backend/app/knowledge/knowledge_base.json
```

The retriever builds a local TF-IDF index in memory and ranks relevant passages using cosine similarity. No external vector database is required for the current small knowledge base.

Coaching responses are constrained to:

- Approved retrieved guidance.
- A maximum of three recommendations.
- No medical diagnosis.
- No invented measurements.
- A safety disclaimer.

If Gemini is unavailable or no API key is configured, deterministic coaching rules provide an offline fallback.

## Project Structure

```text
frontend/                 React UI, camera, pose analysis, dashboard
backend/                  FastAPI API, database, authentication, coaching
shared/exercise-config/   Shared exercise rules and landmark definitions
data/                     Video sources and project data
journals/                 Development journals
```

Important backend areas:

```text
backend/app/models.py       SQLAlchemy database models
backend/app/schemas.py      Pydantic request and response schemas
backend/app/database.py     SQLite and SQLAlchemy setup
backend/app/routers/        API route modules
backend/app/services/       Validation, scoring, aggregation, coaching
backend/app/knowledge/      Knowledge base and TF-IDF retriever
```

## Setup

Install frontend dependencies:

```bash
npm install
```

Set up the backend:

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cd ..
```

Create the required environment files from the available examples and configure Google OAuth and backend secrets before using authentication in production.

## Run Locally

Start the backend:

```bash
cd backend
.venv/bin/uvicorn app.main:app --reload --port 8000
```

Start the frontend in another terminal:

```bash
npm --workspace frontend run dev
```

Open the application at:

```text
http://localhost:5173
```

Open the FastAPI documentation at:

```text
http://localhost:8000/docs
```

## Limitations

- The current analysis is primarily designed for a side-view camera.
- Camera placement and body visibility affect accuracy.
- The primary movement calculations use 2D landmark geometry.
- Calibration requires enough visible movement data.
- The RAG knowledge base is curated and relatively small.
- AI coaching is educational feedback, not medical advice.
- Deadlift and bench-press analysis are not implemented yet.

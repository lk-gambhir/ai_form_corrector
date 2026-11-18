# FormGuard AI

FormGuard AI is a real-time activity-based form-analysis and biomechanics coaching system. It uses a browser camera and MediaPipe Pose Landmarker to track body landmarks, calculate joint angles, detect repetitions, evaluate form, and provide corrective feedback.

**Current support:** Squat, Push-up, and Deadlift are selectable activities with separate analysis configurations, progress pages, score rules, and session filtering. Push-up and Deadlift use heuristic angle-cycle detectors and still need representative fixture/live-camera validation before making accuracy claims. Bench Press remains future scope. See [`PROGRESS.md`](./PROGRESS.md) and [`tasks.md`](./tasks.md) for status and remaining validation work.

The project is designed as an exercise-assistance tool. It is not a medical device and does not diagnose injuries or replace a qualified coach or healthcare professional.

## Project Goals

The system is designed to:

- Detect a user’s body landmarks from webcam video.
- Calculate activity-specific joint angles.
- Reduce landmark noise through temporal smoothing.
- Verify the selected activity's required landmarks and movement signal.
- Count completed activity repetitions.
- Evaluate activity-specific rules and movement metrics.
- Display real-time feedback while the user exercises.
- Store structured workout summaries for later review.
- Create a personal movement baseline through calibration.
- Provide retrieval-grounded AI coaching with a deterministic fallback.

The app supports Squat, Push-up, and Deadlift as separately configured activities. The Push-up and Deadlift detectors are initial 2D landmark heuristics; representative evaluation fixtures have not yet been added. Bench Press remains future scope.

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
Selected exercise detector
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
- Exercise-specific rep detection and form analysis: squat knee-cycle rules,
  push-up elbow/body-line rules, and deadlift hip-hinge/lockout proxies.
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

### Exercise Modules

Each exercise owns a module under `exercises/<exercise>/` with separate
`frontend/`, `backend/`, and `config/` folders. The shared frontend registry at
`shared/exercise-config/index.js` connects the app to each module. The outer
`frontend/` and `backend/` folders stay responsible for shared navigation,
camera/session orchestration, APIs, authentication, and persistence. Shared
landmark indexes and data contracts remain in `shared/exercise-config/`.

## Exercise Analysis Pipeline

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

Squat uses a specialized bilateral knee-angle state machine:

```text
STANDING → DESCENDING → BOTTOM → ASCENDING → STANDING
```

A repetition is committed only after the user returns to the standing state. This prevents incomplete movements from being counted as completed repetitions.

Repetition detection and form evaluation are separate. A shallow squat may count as a completed movement while still receiving a depth warning.

### Push-up and Deadlift detection

Push-up and Deadlift use the shared `ActivityStateMachine` through separate
exercise-owned adapters. It visibility-checks the configured landmarks, waits
for three stable frames at transitions, requires enough signal excursion, and
counts a rep after the signal returns to the start range. They share this
cycle algorithm, but their config supplies different joints and thresholds:

- **Push-up:** uses the shoulder–elbow–wrist angle. The elbow angle moves from
  the top range (about 145°) through the bottom threshold (about 105°) and
  returns to the top. Shoulder–hip–ankle alignment is also required/measured
  for the body-line rule. The initial thresholds are heuristics, not yet
  validated against push-up fixture ground truth.
- **Deadlift:** uses the shoulder–hip–knee angle directly. It decreases from
  upright lockout (start threshold about 145°) to the hinge/setup excursion
  (about 100°), then returns upward. The configured rules check a hip-angle
  lockout proxy and movement range; the camera model does not see bar path or
  estimate 3D spinal loading. These thresholds also need fixture validation.

Squat has a dedicated state sequence and averages the available left/right
knee angles; Push-up and Deadlift currently share a simpler one-signal
lowering/turnaround/return cycle. This is why the new detectors are separate
exercise adapters but not yet independently validated algorithms.

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
frontend/                 Shared React UI, camera/session shell, APIs, dashboard
backend/                  Shared FastAPI API, database, authentication, coaching
shared/exercise-config/   Activity registry, shared contracts, landmarks
exercises/
  squat/{frontend,backend,config}/     Squat detector, score rules, config
  push_up/{frontend,backend,config}/   Push-up detector, score rules, config
  deadlift/{frontend,backend,config}/  Deadlift detector, score rules, config
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
- Push-up and Deadlift need broader validation data; Bench Press analysis is not implemented.

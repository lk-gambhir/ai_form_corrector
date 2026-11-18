# FormGuard AI

FormGuard AI is a real-time activity-based form-analysis and biomechanics coaching system. It uses a browser camera and MediaPipe Pose Landmarker to track body landmarks, calculate joint angles, detect repetitions, evaluate form, and provide corrective feedback.

**Current support:** Squat, Push-up, and Deadlift are supported exercises with separate analysis configurations, score rules, and session filtering. Push-up and Deadlift use heuristic angle-cycle detectors and still need representative fixture/live-camera validation before making accuracy claims. Bench Press remains future scope.

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
Visibility and camera-view checks
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

- **Push-up:** uses the shoulder–elbow–wrist angle. A rep starts when the
  elbow bends below 145°, must pass 115° to count, and ends when the elbow
  returns above 145°. Shoulder–hip–ankle alignment is also required/measured
  for the body-line rule.
- **Deadlift:** uses the shoulder–hip–knee angle directly. It *rises* from the
  floor setup to lockout: a rep starts once the hip opens past 110°, must
  reach 145° to count, and ends when the hip closes back to 110° or below.
  The camera model does not see bar path or estimate 3D spinal loading.

Squat has a dedicated state sequence and averages the available left/right
knee angles; Push-up and Deadlift currently share a simpler one-signal
lowering/turnaround/return cycle. This is why the new detectors are separate
exercise adapters but not yet independently validated algorithms.

### Push-up and Deadlift thresholds and references

Each threshold is marked **cited** (the value or target comes from the source)
or **heuristic** (chosen by this project and still needing validation on real
footage). The rep-detection thresholds above (145°/115° and 110°/145°) are
all heuristic: they decide when a rep starts and counts, not whether it was
good form. The score weights (Push-up 0.6/0.4, Deadlift 0.55/0.45) are also
heuristic.

| Activity | Rule | Threshold | Basis |
|---|---|---|---|
| Push-up | `range_of_motion` | lowest elbow angle ≤ 90° | **Cited**: a standard push-up is lowered "until the elbows reach 90° of flexion" [1]. |
| Push-up | `body_alignment` | shoulder–hip–ankle line within 25° of straight (180°) | **Cited** target: hips neutral, knees extended [1]; about 180° between upper and lower body [2]. **Heuristic**: the 25° tolerance (calibration can narrow it to 20°). |
| Deadlift | `lockout` | highest hip angle ≥ 165° | **Cited** target: lift completion means fully extended hips and knees [3]. **Heuristic**: 15° tolerance below 180° for 2D landmark noise (calibration can lower it to 150°). |
| Deadlift | `movement_range` | lowest (setup) hip angle ≤ 100° | **Cited** magnitude: about 88° of hip extension from lift-off to completion (38.3 ± 6.1° + 49.4 ± 9.7°, Table 1) [3]. **Heuristic**: the 100° cut-off. |

Angles here are 2D angles between MediaPipe landmarks (180° = straight
segments). The studies use 3D marker-based motion capture, and [4] reports
that 2D and 3D deadlift calculations differ significantly. So the sources
support the definitions and rough magnitudes, not exact 2D cut-offs.

1. Kowalski KL, Connelly DM, Jakobi JM, Sadi J. Shoulder electromyography
   activity during push-up variations: a scoping review. *Shoulder Elbow.*
   2022;14(3):326–340. [doi:10.1177/17585732211019373](https://doi.org/10.1177/17585732211019373)
2. San Juan JG, Suprak DN, Roach SM, Lyda M. The effects of exercise type and
   elbow angle on vertical ground reaction force and muscle activity during a
   push-up plus exercise. *BMC Musculoskelet Disord.* 2015;16:23.
   [doi:10.1186/s12891-015-0486-5](https://doi.org/10.1186/s12891-015-0486-5)
3. Hanen NC, Ben Mansour K, Ertel GN, Duchene Y, Gauchard GC. Biomechanical
   analysis of conventional and sumo deadlift. *Front Bioeng Biotechnol.*
   2025;13:1597209. [doi:10.3389/fbioe.2025.1597209](https://doi.org/10.3389/fbioe.2025.1597209)
4. Escamilla RF, Francisco AC, Fleisig GS, et al. A three-dimensional
   biomechanical analysis of sumo and conventional style deadlifts. *Med Sci
   Sports Exerc.* 2000;32(7):1265–1275.
   [doi:10.1097/00005768-200007000-00013](https://doi.org/10.1097/00005768-200007000-00013)

The same references are kept in code next to each threshold
(`exercises/push_up/config/exercise.config.js`,
`exercises/deadlift/config/exercise.config.js`) and in the coaching knowledge
base (`source_url` in `backend/app/knowledge/knowledge_base.json`).

### Squat thresholds and references

Knee valgus is measured with the **knee-to-ankle separation ratio**: the
horizontal distance between the knees divided by the horizontal distance
between the ankles, taken at the deepest point of the rep [5]. A ratio of 1.0
means the knees are directly over the ankles, and a ratio below 1.0 means the
knees are closer together than the ankles, i.e. valgus [5][6]. Only horizontal
distances are used, so camera aspect ratio does not distort it.

| Item | Value | Basis |
|---|---|---|
| Squat depth | lowest knee angle ≤ 90° (≥ 90° of knee flexion) | **Cited**: depth is measured by knee flexion; 70–100° = half squat, > 100° = deep squat, with no universal standard [9]. **Heuristic**: 90° itself (calibration can move it, never below 70°). |
| Squat torso lean | ≤ 30° from vertical (side views) | **Cited** rationale: an erect trunk reduces lower-back load [10]; more forward lean shifts torque to the hips and low back [11]. **Heuristic**: the 30° cap is the top of the 0–30° range [10] studied; no source gives a maximum. (It was 20°, which failed the project's own good-squat clip once angles were corrected for aspect ratio.) |
| Squat tempo | whole rep 0.5–12 s | **Heuristic**, no source. |
| Measure and instant | knee/ankle separation ratio at peak knee flexion | **Cited** [5][6]; builds on the video knee-separation screen of [7] |
| Valgus cut-off | ratio < 0.9 fails | **Heuristic**: [5] states it does not provide threshold values; 0.9 leaves a 10% margin below the 1.0 reference |
| Front-view check | shoulders and hips within 25° of square to the camera | **Heuristic**. The ratio needs a frontal camera [5]; body turn is estimated from MediaPipe landmark depth, which is on roughly the same scale as x [8] |

The ratio can only be measured from the front, and forward torso lean can only
be seen from the side. So a single camera position cannot check everything at
once:

- **Front view** (within 25° of square to the camera): knee valgus is
  measured and torso lean is reported as **not measured**. Facing the camera,
  the 2D knee angle stays near 180° even in a deep squat, so reps are counted
  from how far the hips drop instead. The hip height relative to standing
  height (over the last 10 s) is converted to an equivalent knee angle,
  assuming equal thigh and shin length and a vertical shin: standing = 180°,
  thighs parallel = 90°. **Heuristic** geometric estimate, not from a source;
  depth from the front is therefore approximate.
- **Side or three-quarter view**: depth and torso lean are measured as before,
  and knee valgus is reported as **not measured**.
- A rule that needs a particular view counts only reps where it was measured.
  If no rep was measured, it is left out and the other squat weights are
  rescaled to sum to 1 (`scoreMeasuredBy` in the squat config, mirrored by
  `SCORE_MEASURED_BY` in `exercises/squat/backend/scoring.py`).
- The session summary lists any rule that was not scored and which view it
  needs.

The cited studies used a drop vertical jump, not a bodyweight squat, so they
support the measure and its 1.0 reference, not a squat-specific cut-off. The
bundled squat fixtures are filmed about 60–75° off front-on, so none of their
reps are measured for valgus. The front-view path is checked only with
synthetic landmarks and still needs real front-view footage.

5. Mizner RL, Chmielewski TL, Toepke JJ, Tofte KB. Comparison of
   2-dimensional measurement techniques for predicting knee angle and moment
   during a drop vertical jump. *Clin J Sport Med.* 2012;22(3):221–227.
   [doi:10.1097/JSM.0b013e31823a46ce](https://doi.org/10.1097/JSM.0b013e31823a46ce)
6. Ortiz A, Rosario-Canales M, Rodríguez A, Seda A, Figueroa C, Venegas-Ríos
   HL. Reliability and concurrent validity between two-dimensional and
   three-dimensional evaluations of knee valgus during drop jumps. *Open Access
   J Sports Med.* 2016;7:65–73. [doi:10.2147/OAJSM.S100242](https://doi.org/10.2147/OAJSM.S100242)
7. Noyes FR, Barber-Westin SD, Fleckenstein C, Walsh C, West J. The drop-jump
   screening test: difference in lower limb control by gender and effect of
   neuromuscular training in female athletes. *Am J Sports Med.*
   2005;33(2):197–207. [doi:10.1177/0363546504266484](https://doi.org/10.1177/0363546504266484)
8. Google AI Edge. Pose landmark detection guide for Web (MediaPipe Pose
   Landmarker). <https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js>
9. Schoenfeld BJ. Squatting kinematics and kinetics and their application to
   exercise performance. *J Strength Cond Res.* 2010;24(12):3497–3506.
   [doi:10.1519/JSC.0b013e3181bac2d7](https://doi.org/10.1519/JSC.0b013e3181bac2d7)
10. Lee TS, Song MY, Kwon YJ. Activation of back and lower limb muscles during
    squat exercises with different trunk flexion. *J Phys Ther Sci.*
    2016;28(12):3407–3410. [doi:10.1589/jpts.28.3407](https://doi.org/10.1589/jpts.28.3407)
11. Fry AC, Smith JC, Schilling BK. Effect of knee position on hip and knee
    torques during the barbell squat. *J Strength Cond Res.*
    2003;17(4):629–633. [PMID 14636100](https://pubmed.ncbi.nlm.nih.gov/14636100/)

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

Start the backend (`PYTHONPATH=..` is required: the backend imports the
per-exercise scoring modules from the top-level `exercises/` package):

```bash
cd backend
PYTHONPATH=.. .venv/bin/uvicorn app.main:app --reload --port 8000
```

Or start both servers with `npm run dev` (runs `start.sh`).

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

## Tests

```bash
npm run test:frontend   # Vitest: fixtures, rules, scoring, angle helpers
npm run test:backend    # pytest: auth, timestamps, scoring, coaching
```

## Maintenance

Squat sessions saved before view-aware scoring were scored as if knee valgus,
torso lean and tempo always passed. To recompute stored scores with the
current rules (dry run first, then apply):

```bash
cd backend
PYTHONPATH=.. .venv/bin/python -m app.rescore_sessions
PYTHONPATH=.. .venv/bin/python -m app.rescore_sessions --apply
```

Fixture extraction (`tools/extract_landmarks.py`) has its own dependencies in
`tools/requirements.txt`; install them in a separate virtual environment.

Angles are computed after rescaling landmarks by the video's width/height, so
they are not distorted on widescreen cameras. Fixtures declare their frame
size in `width`/`height`; the synthetic push-up and deadlift fixtures are
generated in square coordinates and declare 1000×1000. Calibration profiles
saved before this change were measured with distorted angles and should be
recalibrated.

## Limitations

- The current analysis is primarily designed for a side-view camera.
- Camera placement and body visibility affect accuracy.
- The primary movement calculations use 2D landmark geometry (corrected for
  the camera's aspect ratio).
- Squat knee valgus needs a front view, while squat depth and torso lean are
  most accurate from the side; one camera position cannot check all of them.
- Calibration requires enough visible movement data.
- The RAG knowledge base is curated and relatively small.
- AI coaching is educational feedback, not medical advice.
- Push-up and Deadlift need broader validation data; Bench Press analysis is not implemented.

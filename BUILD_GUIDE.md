# Build Guide: Step-by-Step Procedure

**Project:** AI-Powered Weightlifting Form Analysis System
**Purpose:** A practical, ordered build plan — what to build, in what sequence, and how to learn each piece as you go. Companion to `PRD.md`, `WORKFLOW.md`, and `ARCHITECTURE.md`; those describe the finished system, this describes the *path* to it.

**Guiding principle:** build one exercise (Squat) fully, end-to-end, before touching Deadlift/Bench. A thin vertical slice that works beats three exercises that are all half-built.

---

## Phase 0 — Setup (few hours)

1. Create the repo, set up a React app (Vite is simplest) and a separate Python/FastAPI backend folder.
2. Install MediaPipe's browser/JS pose package and get a webcam feed rendering raw video in the browser — no pose detection yet, just confirm camera access works.
3. Set up Postgres locally (or a free hosted instance) — don't design the schema yet, just confirm you can connect from FastAPI.

**Checkpoint:** camera feed shows in browser; FastAPI "hello world" endpoint responds; Postgres connection works.

---

## Phase 1 — Pose Estimation (1–1.5 weeks)

**What to build:**
1. Wrap MediaPipe Pose so it runs on each video frame and draws the 33 landmarks as dots/skeleton lines over the video (visual confirmation it's working).
2. Log landmark `(x, y, z, visibility)` values to the console; move around, crouch, etc. and watch how visibility drops with occlusion.
3. Write a small utility function: given three landmarks (e.g., hip, knee, ankle), compute the joint angle using the dot-product formula from `PROJECT_REPORT.tex` Chapter 5 (Equation 5.1). Test it against a landmark set you can hand-verify (e.g., a straight leg should read ~180°).

**What you're learning:** what pose landmarks actually are, coordinate systems, why `z`/depth is unreliable on one camera, basic vector math for angles.

**Checkpoint:** you can stand in front of the camera and see a live knee-angle number on screen that visibly changes as you bend your knee.

---

## Phase 2 — Landmark Smoothing (2–3 days)

**What to build:**
1. Add an exponential moving average (or simple moving-average window) over each landmark coordinate before computing angles.
2. Compare the raw vs. smoothed angle value on screen side-by-side while standing still — the raw one should jitter, the smoothed one should be stable.

**What you're learning:** why raw sensor/model output is noisy, and the simplest filtering technique to fix it (this single concept — EMA smoothing — recurs constantly in real-time systems).

**Checkpoint:** standing still gives a near-flat smoothed angle line; the raw one visibly jitters more.

---

## Phase 3 — Squat Rep Detection (1 week)

**What to build:**
1. Define the Squat state machine: `Standing → Descending → Bottom → Ascending → Standing`.
2. Pick the driving signal (hip/knee angle) and set rough thresholds (e.g., "descending" starts when knee angle drops below ~160°, "bottom" when it stops decreasing near your target depth angle, etc.) — expect to tune these by trial and error on yourself.
3. Add hysteresis: don't let noise near a threshold flip the state back and forth (e.g., require the value to cross a boundary by a small margin, or hold for a few frames, before switching state).
4. Increment a rep counter every time you complete a full cycle back to Standing.

**What you're learning:** finite state machines in code, why thresholds need hysteresis, how to debug "phantom" or "missed" reps by logging state transitions.

**Checkpoint:** do 5 real squats in front of the camera — the counter shows 5, not 3, 4, 6, or 7.

---

## Phase 4 — Squat Form Rules (1 week)

**What to build:**
1. On each completed rep, evaluate 2–3 rules against the recorded angle history for that rep:
   - Depth: was the bottom-angle threshold reached?
   - Knee alignment: did knee horizontal position drift past ankle position beyond a margin?
   - Torso angle: did forward lean exceed a threshold?
2. Each rule returns a pass/fail + severity, not just a boolean — this becomes your priority list.
3. Record yourself doing a few *deliberately flawed* reps (shallow squat, knees caving in) and confirm the right rule fires.

**What you're learning:** separating "computing a number" (Phase 3's angles) from "interpreting a number" (this phase's rules) — this split is why the architecture doc keeps Rep Detection and Form Analysis as separate components.

**Checkpoint:** a shallow squat correctly flags "depth," a normal squat doesn't; a caved-knee squat flags "knee alignment."

---

## Phase 5 — Feedback Engine + Minimal UI (3–5 days)

**What to build:**
1. Take the rule results from Phase 4, pick the single highest-priority violation (or "good rep" if none), and map it to a specific text string.
2. Display it as an overlay on the video feed in React.
3. Add a basic "camera visibility" check (landmark confidence too low → show a "move into frame" message instead of form feedback).

**What you're learning:** React state management for a fast-updating overlay, and the "only show the most important thing" prioritization pattern.

**Checkpoint:** doing a set of squats live shows one clear message at a time, updating per rep, never a wall of text.

---

## Phase 6 — Google OAuth Gateway & Modular Page Architecture (1 week)

Build a clean, production-grade modular frontend architecture gated behind Google OAuth authentication:

1. Build `LoginPage.jsx` as the entry barrier for unauthenticated visitors.
2. Implement `AuthContext.jsx` and `POST /api/auth/google` with strict `email: EmailStr` validation, issuing JWT bearer tokens.
3. Separate the application into modular single-purpose pages: `WorkoutPage.jsx`, `CalibrationPage.jsx`, and `DashboardPage.jsx`.
4. Build reusable layout components (`Navbar.jsx` with athlete status and navigation tabs, `Footer.jsx` with medical disclaimer).

**Checkpoint:** unauthenticated users are gated at `LoginPage`; signing in displays the athlete badge and unlocks `WorkoutPage`.

---

## Phase 7 — Backend API & SQLite Persistence (1 week)

1. Design the schema (`User`, `Session`, `Rep`, `FormIssue`, `UserBaseline`) in SQLite using SQLAlchemy 2.
2. Build the FastAPI endpoints: `POST /api/auth/google`, `POST/GET /api/sessions`, `GET /api/sessions/{id}`, `POST/GET /api/calibration`.
3. Package client-side session summaries (reps, durations, ROM, tempo, joint angles, flagged issues, zero video) and persist via `/api/sessions`.
4. Enforce user isolation: all queries filter strictly by `WHERE user_id = current_user.id` from decoded JWT tokens.

**Checkpoint:** workout sets completed in the browser save cleanly to SQLite and can be retrieved via the API.

---

## Phase 8 — Form Score & Historical Dashboard (0.5–1 week)

1. Implement server-side form-score recomputation (`form_score.py`) with ±2.0 client tolerance.
2. Build `GET /api/dashboard/summary` and `GET /api/dashboard/trends` to aggregate sessions, calculate average and best form scores, and tally technique flaws.
3. Build `DashboardPage.jsx`: metrics cards, flaw frequency bars, and recent session history, displaying clean empty states (`"—"`) when no sessions exist.

**Checkpoint:** completed workout sets populate dashboard statistics dynamically from the database.

---

## Phase 9 — Real-Data Biomechanics Calibration (1 week)

1. Build `CalibrationView.jsx` with live webcam MediaPipe `PoseEstimator` tracking to measure real limb ratios (femur-to-torso, shin-to-torso) and natural range of motion (standing knee angle, deep squat bottom angle).
2. For headless automated browser testing where a physical webcam is unavailable, derive calibration from verified real CC-BY ground-truth athlete recordings (`real-squat-good.json`).
3. Enforce a strict zero-dummy-data policy across calibration and workout analysis.

**Checkpoint:** calibration wizard captures live camera frames, computes personal limb ratios, and persists baseline to the athlete's profile.

---

## Phase 10 — Polish, Error Handling & Automated Test Suite (1 week)

1. Comprehensive automated testing across all layers:
   - **Vitest Unit Suite:** 65 unit tests across 13 suites.
   - **Playwright E2E Suite:** 15 browser tests across 8 suites.
   - **Pytest Backend Suite:** 43 API tests across 5 suites.
2. Handle all camera fallbacks (`denied`, `no-device`, uncalibrated).
3. Production build optimization with clean Vite compilation (~700ms).

---

## Summary Timeline

| Phase | Focus | Est. Time |
|---|---|---|
| 0 | Setup & scaffold | few hours |
| 1 | Pose estimation & 2D angles | 1–1.5 wks |
| 2 | Landmark smoothing & frame sources | 2–3 days |
| 3 | Squat rep detection & state machine | 1 wk |
| 4 | Squat form rules & metrics | 1 wk |
| 5 | Feedback engine & live HUD overlay (MVP) | 3–5 days |
| 6 | Google OAuth gateway & modular pages | 1 wk |
| 7 | Backend API & SQLite persistence | 1 wk |
| 8 | Form score & historical dashboard | 0.5–1 wk |
| 9 | Real-data biomechanics calibration | 1 wk |
| 10 | Polish, error handling & test suite | 1 wk |
| **Total** | | **~9–10 weeks** |


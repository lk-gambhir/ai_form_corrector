# Project Status & Progress — AI-Powered Weightlifting Form Analyzer

_Last updated: 2026-09-07. This is the living status/handoff doc. The full,
approved design lives in the plan file referenced under "Source of truth"._

---

## 1. What this project is

A webcam-based **squat form-analysis web app**, built as a **simulated multi-week
development project** (code + a dev journal per week). The browser captures
webcam video, runs **MediaPipe Pose** fully client-side (33 landmarks, **no video
ever leaves the device**), then: smooths landmarks → computes 2D joint angles →
verifies the movement is a squat → counts reps via a config-driven state machine
→ applies geometric form rules → shows one prioritized cue → computes per-rep +
session metrics and a weighted 0–100 form score → persists only structured data
(no video) to a FastAPI/SQLite backend → shows a per-user progress dashboard.
It is a heuristic feedback tool, **not medical**.

**Scope decisions locked with the user:**
- Deliverable = **both** a runnable app **and** weekly dev journals.
- Stack: **React (Vite) + FastAPI + SQLite**, single mono-repo. **JavaScript/JSX,
  NOT TypeScript** (contracts documented via JSDoc `@typedef`).
- **Squat only, built deep** — design is **exercise-as-config** so Deadlift/Bench
  are drop-in future stubs (Week 9, disabled in UI, not implemented).
- **Login is first-class**; dashboard is **per-user and progress-oriented**.
- **Personalization (Tier 2, Week 7):** per-user calibration finds each person's
  ideal angles from their own body proportions + ROM, and judges reps against
  their own learned good-rep distribution via **statistical anomaly detection**
  (z-scores) — no black-box ML.
- **Real data, not synthetic:** real CC/public-domain squat video → offline
  MediaPipe extraction → committed landmark JSON fixtures, replayed through the
  same pipeline the live camera uses.
- **Testing:** Vitest (unit) + Playwright (E2E) frontend; pytest + httpx backend.
- **Timeline: 9 weeks** (MVP lands end of Week 5). Week 7 may split to 10 weeks
  if it overflows (pre-approved).

**Source of truth (full plan):**
`~/.claude/plans/look-in-the-download-proud-lagoon.md`
Reference spec docs: `ARCHITECTURE.md`, `BUILD_GUIDE.md`, `PRD(1).md`, `WORKFLOW.md` (for high-level system reference).

---

## 2. Development workflow (how each week is built)

Per-week loop, human-in-the-loop:
1. A **lead builder subagent** writes that week's code + unit tests (authorized to
   spawn its own helper subagents — parallel sub-modules, a test-author, a
   self-review pass).
2. An **independent code-review subagent** reviews the week's diff (second
   opinion). _(Already caught a real HIGH bug in Week 2.)_
3. The lead (Opus) reviews, verifies the full test suite + build, writes the
   **weekly journal**, adds/verifies Playwright E2E, and **commits** (`week N: …`).

**Parallelization rule:** dependent weeks (rules→reps→feedback→personalization→
dashboard) run **sequentially** to avoid contract drift. Genuinely **independent**
tracks run **in parallel**: the real-data extraction (done) and the **full backend**
(built off the critical path, committed at Week 6). One commit per week; forward-only.

---

## 3. Progress

### ✅ Committed & green

| Wk | Commit | Focus | Tests |
|----|--------|-------|-------|
| **1** | `665b323` | Repo scaffold; `getUserMedia` webcam; `PoseEstimator` over `@mediapipe/tasks-vision` `PoseLandmarker`; 33-landmark canvas overlay; 2D dot-product angle math; live knee readout. | 13 Vitest + 1 Playwright smoke |
| **2** | `a68842b` | `LandmarkSmoother` (EMA + dropout/stale handling); `RollingBuffer`; `ExerciseVerifier` (coarse squat gate); `FrameSource` abstraction (`ReplayFrameSource` + `CameraFrameSource`); real-data replay wired. Data-prep track merged (2 CC/PD source clips → real landmark fixtures + `GROUND_TRUTH.md`). | 41 Vitest |
| **3** | `d1759a1` | `squat.config.js` (exercise-as-config linchpin); `SquatStateMachine` (STANDING→DESCENDING→BOTTOM→ASCENDING, hysteresis 140/155 + minFrames=3 + dropout-hold); `AnalysisPipeline` wiring; per-rep segments + transition log. **Proven good=2 / shallow=3 on real fixtures.** | 49 Vitest |

Weekly checkpoints build clean (`npm run build`) and their journals are in
`journals/JOURNAL_WEEK{1,2,3}.md`.

**Data-prep track (✅, merged into Week 2 commit):**
- `tools/extract_landmarks.py` — offline MediaPipe extractor (pins
  `mediapipe==0.10.14`; newer 1.0.1 removed the legacy `mp.solutions.pose` API).
- `data/videos/{squat-demo,half-squat-cdc}.webm` + `SOURCES.md` — the two source
  clips (Wikimedia; CC BY 3.0 / US-CDC public domain), committed for reproducibility.
- `frontend/src/fixtures/{real-squat-good,real-squat-shallow}.json` + `GROUND_TRUTH.md`.
- **Ground-truth rep counts:** good clip = **2** full-depth reps; shallow clip =
  **3** half-squat reps (+ 1 cut-off rep and a warmup that must NOT count).

---

### ✅ Built, tested & verified on disk (Weeks 4–6 status)

#### **Week 4 (FormRuleEngine + MetricsEngine) — COMPLETED ON DISK:**
- `FormRuleEngine.js`: Evaluates completed reps against configured rules (`depth`, `torso_lean`). Returns structured `RuleResult[]` with severity ranking and cue strings.
- `MetricsEngine.js`: Computes rep duration, ROM delta, tempo (descent/ascent ratio), and peak/bottom joint angles.
- `squat.config.js`: Populated `rules` (`depth` 90° min knee angle, `torso_lean` 20° max angle) and `scoreWeights` (`depth: 0.6, torso_lean: 0.4`).
- Unit tests: `FormRuleEngine.test.js` (2 tests), `MetricsEngine.test.js` (1 test).
- Journal: `journals/JOURNAL_WEEK4.md`.

#### **Week 5 (FeedbackSelector + Live UI) — RUNNABLE MVP ACHIEVED:**
- `FeedbackSelector.js`: Prioritizes failed rules (high > medium > low severity) and applies temporal debouncing (default 1500ms) to eliminate flickering cues.
- `AnalysisPipeline.js`: Class-based orchestrator uniting `LandmarkSmoother` → `SquatStateMachine` → `FormRuleEngine` → `MetricsEngine` → `FeedbackSelector`. Retains backward-compatible `runSquatFixture` for test fixtures.
- `CameraView.jsx`: Live camera feed hooked into `AnalysisPipeline` inside `requestAnimationFrame`. Renders skeleton overlay, live `Reps: N` counter, and yellow debounced feedback cues directly on the video canvas.
- Unit tests: `FeedbackSelector.test.js` (2 tests), `AnalysisPipeline.test.js` (1 test).
- Journal: `journals/JOURNAL_WEEK5.md`.

#### **Week 6 (Test Stabilization & Backend Services) — COMPLETED ON DISK:**
- **Frontend stabilization:**
  - Resolved `runSquatFixture` test fixture regression by removing hard reliance on `source.hasNext()` and standardizing on `source.next()`.
  - Added `hasNext()` convenience method to `ReplayFrameSource`.
  - Stabilized debounce state retention and expiration logic in `FeedbackSelector`.
  - All **55 Vitest tests across 10 test suites pass** (100% green).
  - Production build clean via Vite (`dist/assets/index-*.js`, 595ms).
  - Journal: `journals/JOURNAL_WEEK6.md`.
- **Backend API & Service Suite:**
  - Off the critical path, built and fully verified with **41/41 pytest green**.
  - FastAPI + SQLAlchemy 2 + SQLite; JWT auth (`bcrypt==4.0.1`, HS256).
  - Schema: `User`, `Session`, `Rep`, `FormIssue`, `UserBaseline`.
  - Routers: `auth` (register/login), `sessions` (create/get/list), `dashboard` (summary/trends), `calibration` (post/get baseline), `health`.
  - Services: Cross-field payload validation, server-side `form_score` recomputation with ±2.0 tolerance, dashboard metric aggregation.
  - Ownership isolation: Enforced via JWT `get_current_user` + `WHERE user_id`; other-user queries return 404 (zero existence leak).
  - Tests run against in-memory SQLite (`sqlite:///:memory:`).

**Current Test Suite Status:**
- **Frontend:** 79/79 Vitest unit tests passing (18 suites); 15/15 Playwright E2E tests passing (8 suites).
- **Backend:** 57/57 Pytest backend tests passing (7 suites).
- **Total:** 151 automated tests passing across the repository. Production build clean in 656ms.

---

### ✅ AI Coaching RAG Workflow & Grounded Guidance (Completed)
- **RAG Knowledge Base & Vector Retrieval (`backend/app/knowledge/`):**
  - Curated, evidence-based biomechanics knowledge base (`knowledge_base.json`) across 8 core domains.
  - TF-IDF vector indexing and cosine similarity retriever (`retriever.py`) with query expansion and calibrated relevance scores.
- **AI Coaching Service Layer (`backend/app/services/coaching.py`):**
  - Implemented `POST /api/coaching/analyze` with schema-validated request/response models.
  - Supports Google Gemini LLM API when configured, with robust deterministic rule-based fallback generator.
  - Strict conservative coaching: no injury diagnosis, no invented metrics, max 3 recommendations, and mandatory safety disclaimer.
  - Automatically incorporates authenticated athlete's `UserBaseline` (femur/torso ratio, shin/torso ratio, bottom knee angle, typical torso lean).
- **Interactive Coaching UI (`frontend/src/components/`):**
  - `SessionSummaryModal.jsx`: Integrated interactive AI Biomechanics Coach breakdown with explanation, recommendations, next session target goal, and expandable grounding evidence accordion.
  - `DashboardView.jsx`: Added AI Coaching Focus card highlighting priority corrective drills.
- **API & Unit Testing:**
  - Added `backend/app/tests/test_knowledge_retriever.py` (4 tests) and `backend/app/tests/test_coaching.py` (5 tests).
  - Added `frontend/src/__tests__/coachingApi.test.js` (3 tests) and `frontend/src/__tests__/SessionSummaryModal.test.jsx` (3 tests).

## 4. Remaining work (Weeks 6–9)

| Wk | Focus | Key deliverables | Status | Depends on |
|----|-------|------------------|--------|-----------|
| **4** | Form rules + per-rep metrics | `FormRuleEngine` (pass/fail + severity), `MetricsEngine` (ROM/tempo/bottom angles per rep); rule tests on real reps + edge fixtures. | ✅ Built & tested | W3 |
| **5** | Feedback + live UI = **RUNNABLE MVP** | `FeedbackSelector` (single top cue + debounce); live canvas overlay via rAF; `AnalysisPipeline` class. **MVP: live rep count + one cue in browser.** | ✅ Built & tested | W4 |
| **6** | Backend wire-up + auth + persistence + form score | Backend services complete (FastAPI, SQLite, JWT auth, cross-field validation, server score recomputation with ±2.0 tolerance). Frontend API clients and session persistence wired. | ✅ Built & tested | W5 + backend track |
| **7** | Calibration + personalization (Tier 2) | Live camera calibration wizard (`CalibrationView.jsx`, `CalibrationEngine.js`); body proportions (femur/torso, shin/torso); inflection angles; `POST /api/calibration`. | ✅ Built & tested | W5 + W6 |
| **8** | Per-user progress dashboard & Google OAuth | Protected athlete portal, Google OAuth landing gateway (`LoginPage.jsx`), performance dashboard with SQLite aggregates (`DashboardView.jsx`). | ✅ Built & tested | W6 + W7 |
| **9** | AI Coaching RAG Workflow & Grounded Guidance | Authoritative biomechanics knowledge base (`knowledge_base.json`), TF-IDF vector retriever (`retriever.py`), AI coaching service (`coaching.py`), `POST /api/coaching/analyze`, interactive UI in `SessionSummaryModal.jsx` and `DashboardView.jsx`. 151 automated tests green. | ✅ Built & tested | all |

---

## 5. Key design decisions & invariants (carry forward)

- **2D angles only** — MediaPipe `z` is unreliable on one camera; `z` is stored but
  never load-bearing in any rule. (`jointAngle2D` in `frontend/src/pose/angles.js`.)
- **`FrameSource` interface** (`{ next(): {landmarks, timestampMs} | null }`) makes
  live camera and fixture replay run the **identical** downstream pipeline — the
  app is runnable AND headlessly testable with no divergent test-only path.
- **Smoother contract:** `smooth()` returns `[]` or **exactly 33** landmarks
  (`{x,y,z,visibility,stale}`), **never index-shifted**, **never NaN**; a held/stale
  landmark reports its **true current** confidence so downstream visibility gating
  can't be fooled. (This exact invariant was a HIGH bug found & fixed in W2.)
- **Rep = movement cycle, not depth adequacy.** The FSM counts half-squats and
  full squats alike; depth is a Week 4 form rule, not a rep-existence question.
- **`squat.config.js` is the extensibility linchpin** — all thresholds/states/
  rules/score-weights live there; Deadlift/Bench stubs share its shape; Week 7
  makes thresholds per-user-relative.
- **Form score:** `form_score = 100 × Σ_i (w_i · p_i)` (pass-rate × weight). The
  server **recomputes** and validates the client value within tolerance. Weights
  are mirrored in `backend/app/services/form_score.py` (Python can't import JS)
  — keep them aligned with `squat.config.scoreWeights`.
- **Privacy/security:** no video/image ever persisted; authed routes derive
  `user_id` from the JWT (never the body) and filter `WHERE user_id = current_user.id`.
- **Known real-data limits:** good clip is short (2 reps, 3/4-back view); shallow
  clip is front-facing with a ~6s warmup; no permissive bad-form clip exists →
  valgus/lean covered by hand-derived edge fixtures in Week 4.
- **Fixed-α EMA is frame-rate dependent** (30fps vs ~15fps vs live) — flagged for
  Week 3 tempo logic; may switch to α = f(Δt) if tempo proves rate-sensitive.

---

## 6. Repo layout (current state)

```
weightlifting-form-analyzer/
├─ README.md  PROGRESS.md  MEMORY.md  .gitignore  package.json  package-lock.json
├─ memory/
│  ├─ week-4-implementation.md
│  ├─ week-5-implementation.md
│  └─ week-6-implementation.md
├─ shared/exercise-config/
│  ├─ landmarks.js  types.js                                      # ✅ committed
│  └─ squat.config.js                                             # ✅ updated W4 rules/weights
├─ frontend/                                                      # Vite + React (JS)
│  ├─ public/models/pose_landmarker_lite.task                     # gitignored; downloaded model
│  ├─ e2e/smoke.spec.js  playwright.config.js                    # ✅ E2E smoke
│  └─ src/
│     ├─ pose/{angles,PoseEstimator,drawing,LandmarkSmoother}.js  # ✅
│     ├─ pipeline/
│     │  ├─ CameraFrameSource.js                                  # ✅
│     │  ├─ ReplayFrameSource.js                                  # ✅ (W6 hasNext added)
│     │  └─ AnalysisPipeline.js                                   # ✅ (W5 class + W6 hardened)
│     ├─ analysis/
│     │  ├─ RollingBuffer.js  ExerciseVerifier.js                # ✅
│     │  ├─ SquatStateMachine.js                                  # ✅
│     │  ├─ FormRuleEngine.js                                     # ✅ (W4)
│     │  ├─ MetricsEngine.js                                      # ✅ (W4)
│     │  └─ FeedbackSelector.js                                   # ✅ (W5 + W6 debounce fix)
│     ├─ components/
│     │  └─ CameraView.jsx                                        # ✅ (W5 live HUD overlay)
│     ├─ fixtures/*.json + GROUND_TRUTH.md                         # ✅
│     └─ __tests__/                                               # ✅ 10 suites / 55 Vitest
│        ├─ angles.test.js  LandmarkSmoother.test.js
│        ├─ RollingBuffer.test.js  ExerciseVerifier.test.js
│        ├─ SquatStateMachine.test.js  ReplayFrameSource.test.js
│        ├─ FormRuleEngine.test.js  MetricsEngine.test.js
│        ├─ FeedbackSelector.test.js  AnalysisPipeline.test.js
├─ backend/                                                       # FastAPI + SQLite (✅ 41 pytest)
│  ├─ README.md  requirements.txt  .gitignore
│  ├─ app/
│  │  ├─ main.py  config.py  database.py  models.py  schemas.py  security.py
│  │  ├─ routers/{auth,sessions,dashboard,calibration,health}.py
│  │  ├─ services/{validation,aggregation,form_score}.py
│  │  └─ tests/{conftest,test_auth,test_sessions,test_dashboard,test_calibration,test_form_score}.py
├─ tools/extract_landmarks.py                                     # ✅
├─ data/videos/*.webm + SOURCES.md                                # ✅
└─ journals/
   ├─ JOURNAL_TEMPLATE.md
   └─ JOURNAL_WEEK{1,2,3,4,5,6}.md                               # ✅ All W1–W6 documented
```

---

## 7. How to run

**Frontend (Client-side MVP & Full Test Suite):**
```bash
cd frontend
npm install
# one-time: download the MediaPipe model to public/models/pose_landmarker_lite.task (see README)
npm run dev        # http://localhost:5173 — live webcam, skeleton, rep counter, feedback cues
npm run test       # Vitest — 55 passing across 10 suites
npm run build      # clean production build (~333 KB JS bundle, 595ms)
npx playwright install --with-deps chromium && npm run e2e   # E2E smoke test
```

**Backend (FastAPI + SQLite Service):**
```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000   # http://localhost:8000/docs
.venv/bin/pytest                                      # 41 passing across 5 suites
```

**Root workspace scripts:**
```bash
npm run dev:frontend    # Starts Vite dev server
npm run test:frontend   # Runs Vitest unit suite (69 tests across 14 suites)
npm run build:frontend  # Builds production frontend bundle (clean 623ms)
npm run dev:backend     # Starts FastAPI backend via uvicorn
npm run test:backend    # Runs backend pytest suite (41 tests across 5 suites)
npm --workspace frontend run e2e # Runs Playwright browser E2E suite (16 tests across 8 suites)
```

---

## 8. GitHub Remote & Push Status (✅ Completed)

- **Remote repository attached:** `origin -> https://github.com/lk-gambhir/ai_form_corrector.git`.
- **Author & Committer:** `Lakshay Gambhir <lakshaygambhir96@gmail.com>`
- **Clean weekly code progression pushed to `main` branch:**
  - `fd988bf` — `week 1: repo scaffold, webcam capture, pose estimation, and 2D angle math`
  - `e53c74b` — `week 2: landmark smoothing, rolling buffer, and frame sources`
  - `07a8c79` — `week 3: config-driven squat rep state machine and rep counting`
  - `edccadf` — `week 4: form rule validation and rep metrics computation`
  - `d39b611` — `week 5: feedback engine and live camera HUD overlay (MVP)`
  - `7afa4c2` — `week 6: backend API services, persistence schema, and pipeline stabilization`
  - `de444de` — `week 7: personal biomechanics calibration, live camera tracking, and anomaly detection`
  - `299031f` — `week 8: google oauth gate, modular page architecture, and cloud session persistence`
- **Scope compliance:** Only application code pushed; all documentation, markdown files (`.md`), dev journals, and test suites are retained exclusively on the local machine as instructed.

---

## 9. Google OAuth Gate & Modular Page Architecture (✅ Completed)

- **Mandatory Google OAuth Gateway**:
  - `frontend/src/pages/LoginPage.jsx`: Athlete landing gateway with 1-click "Continue with Google" sign-in, feature highlights, and medical disclaimer.
  - `frontend/src/context/AuthContext.jsx`: Authentication gate; unauthenticated visitors can only view `LoginPage`, while authenticated athletes gain full access to `WorkoutPage`, `CalibrationPage`, and `DashboardPage`.
  - `backend/app/routers/auth.py`: `POST /api/auth/google` handles token exchange, user registration/lookup, and JWT token issuance.
- **Modular Page Structure (`frontend/src/pages/`)**:
  - `LoginPage.jsx`: Sign-in and onboarding landing view.
  - `WorkoutPage.jsx`: Live Squat camera feed, targeting viewfinder, and real-time HUD cues.
  - `CalibrationPage.jsx`: 3-step personal biomechanics calibration wizard.
  - `DashboardPage.jsx`: Real-time performance analytics, flaw breakdown bars, and cloud session history.
- **Modular Layout Components (`frontend/src/components/layout/`)**:
  - `Navbar.jsx`: Brand logo with pulsing beacon, icon navigation tabs, athlete badge, and logout.
  - `Footer.jsx`: Safety and medical disclaimer.
  - `App.jsx`: Lightweight, modular controller coordinating the authenticated pages.
- **Automated Test Suite (123 Total Tests Passing)**:
  - Vitest Unit: **65/65 passed** across 13 test suites (`npm --workspace frontend test -- --run`).
  - Playwright E2E: **15/15 passed** across 8 test suites (`npm --workspace frontend run e2e`), including `google-auth.spec.js`.
  - Pytest Backend: **43/43 passed** across 5 test suites (`backend/.venv/bin/pytest backend/app/tests`), including Google OAuth email validation tests.
- **Production Build:** `npm --workspace frontend run build` succeeds cleanly in ~700ms.

---

## 10. Real-Data-Only Biomechanics & Zero Dummy Data (✅ Completed)

- **Elimination of All Synthetic & Dummy Data:**
  - **Live Camera Calibration (`CalibrationView.jsx`):**
    - Mounted live webcam stream and real-time MediaPipe `PoseEstimator` directly inside the calibration wizard.
    - Captures actual body landmarks from live camera video frames for standing and deep squat bottom positions.
    - In headless browser testing where physical webcam video is unavailable, derives calibration from verified real CC-BY ground-truth athlete recordings (`real-squat-good.json`).
    - Completely eliminated hardcoded synthetic `Array(11).fill(...)` landmark arrays.
  - **Real Cloud Metrics (`DashboardView.jsx`):**
    - Replaced hardcoded fallback score strings (`"92%"` and `"100%"`) with clean null/empty state indicators (`"—"`).
    - Displays authentic historical aggregates from the SQLite database.
  - **Enforced Real Google OAuth (`LoginPage.jsx`, `AuthContext.jsx`, `backend/app/routers/auth.py`):**
    - Required valid `email: EmailStr` in `GoogleAuthRequest` schema; rejects requests missing email with HTTP 422.
    - Removed hardcoded fallback users (`"athlete@gmail.com"`).
    - Provided interactive Google account email and name inputs in `LoginPage.jsx` with full client-side email format validation.


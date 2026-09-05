# Project Status & Progress — AI-Powered Weightlifting Form Analyzer

_Last updated: 2026-09-05. This is the living status/handoff doc. The full,
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
Original spec docs: `~/Downloads/{PRD(1),ARCHITECTURE,WORKFLOW,BUILD_GUIDE}.md`.

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
| **3** | _(this commit)_ | `squat.config.js` (exercise-as-config linchpin); `SquatStateMachine` (STANDING→DESCENDING→BOTTOM→ASCENDING, hysteresis 140/155 + minFrames=3 + dropout-hold); `AnalysisPipeline` wiring; per-rep segments + transition log. **Proven good=2 / shallow=3 on real fixtures.** | 49 Vitest |

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

### ✅ Built & tested but intentionally NOT yet committed — the full backend (lands at Week 6)

Off the critical path, built in parallel, **41/41 pytest green.** On disk under
`backend/` as **untracked** files (will be committed with the Week 6 frontend
wire-up so commit order stays forward-only):
- FastAPI + SQLAlchemy 2 + SQLite; JWT auth (bcrypt, pinned `bcrypt==4.0.1`);
  full schema (USER/SESSION/REP/FORM_ISSUE/USER_BASELINE);
  endpoints `POST/GET /api/sessions`, `GET /api/sessions/{id}`,
  `POST /api/auth/{register,login}`, `GET /api/dashboard/{summary,trends}`,
  `POST/GET /api/calibration`, `GET /api/health`.
- **Ownership isolation** enforced (`get_current_user` from JWT + `WHERE user_id`)
  and tested with two-user fixtures; other-user rows return 404 (no existence leak).
- `form_score` server-recompute with ±2.0 tolerance; **persists the server value**,
  not the client's. Default weights `{depth .35, knee_valgus .25, torso_lean .25,
  tempo .15}` mirror the frontend `squat.config.scoreWeights` (must be kept in
  sync once Week 4 fills them in).
- Backend self-review flagged (for the Week 6 review): dev-default JWT secret must
  be overridden in prod; stateless JWT has no revocation; `0 reps → score 100`
  default; `most_common_issues` tie-break order is incidental.
- Added a scoped `backend/.gitignore` (root `data/*.db` / `backend/.venv/` patterns
  don't match `backend/data/app.db` — gitignore `/`-patterns are dir-relative).

_(Not started yet: Weeks 4, 5, 7, 8, 9 — see §4.)_

---

## 4. Remaining work (Weeks 3–9)

| Wk | Focus | Key deliverables | Depends on |
|----|-------|------------------|-----------|
| **3** ⏳ | Rep FSM | `squat.config.js`, `SquatStateMachine` (hysteresis/minFrames), transition log, per-rep segments; prove good=2/shallow=3 headlessly. | W2 |
| **4** | Form rules + per-rep metrics | `FormRuleEngine` (pass/fail + severity), `MetricsEngine` (ROM/tempo/bottom angles per rep); rule tests on real reps + small **hand-derived edge fixtures** for valgus/lean (no bad-form clip exists under a permissive license). | W3 |
| **5** | Feedback + live UI = **RUNNABLE MVP** | `FeedbackSelector` (single top cue + debounce); live canvas overlay via rAF; visibility gating; exercise-select (squat active, others disabled). **MVP: live rep count + one cue in browser, no backend.** Tag `mvp-week5`. New Playwright E2E over the live UI. | W4 |
| **6** | Backend wire-up + auth + persistence + form score | Wire frontend `authApi`/`sessionApi` + Login/Register + token storage to the already-built backend; end session → POST persists; verify no cross-user leakage. (Backend itself already built in parallel — this week = integration + journal + commit.) | W5 + backend track |
| **7** | Calibration + personalization (Tier 2) | Calibration capture flow (N good reps + full-extension pose); `baseline.js` (limb ratios, personal ROM, per-angle mean/variance); make FSM + rule thresholds **relative to baseline**; `anomaly.js` (z-score vs own good-rep distribution); persist baseline via `POST /api/calibration`. **Densest week — may split → 10 weeks.** | W5 + W6 |
| **8** | Per-user progress dashboard | Protected `/dashboard`; Recharts trends (form-score, ROM/depth, tempo, reps); common issues; best-vs-recent; **improvement vs calibrated baseline**; "ideal vs achieved angle" view. Consumes backend dashboard endpoints (already built). | W6 + W7 |
| **9** | Testing + error handling + polish + report | Threshold tuning vs full suite; **confidence-dropout mid-rep** → prove pause/warn (no phantom rep); WORKFLOW §18 error matrix; Deadlift/Bench **config stubs** (disabled, not broken); README/run scripts/demo; fill report placeholders. | all |

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
  are duplicated in `backend/app/services/form_score.py` (Python can't import JS)
  — **keep them in sync**.
- **Privacy/security:** no video/image ever persisted; authed routes derive
  `user_id` from the JWT (never the body) and filter `WHERE user_id = current_user.id`.
- **Known real-data limits:** good clip is short (2 reps, 3/4-back view); shallow
  clip is front-facing with a ~6s warmup; no permissive bad-form clip exists →
  valgus/lean covered by hand-derived edge fixtures in Week 4.
- **Fixed-α EMA is frame-rate dependent** (30fps vs ~15fps vs live) — flagged for
  Week 3 tempo logic; may switch to α = f(Δt) if tempo proves rate-sensitive.

---

## 6. Repo layout (current + planned)

```
weightlifting-form-analyzer/
├─ README.md  PROGRESS.md  .gitignore  package.json  package-lock.json
├─ shared/exercise-config/
│  ├─ landmarks.js  types.js            # ✅ committed
│  └─ squat.config.js                   # ⏳ W3 (in flight)
├─ frontend/                            # Vite + React (JS)
│  ├─ public/models/pose_landmarker_lite.task   # gitignored; README download step
│  ├─ e2e/  playwright.config.js        # ✅ smoke; more in W5
│  └─ src/
│     ├─ pose/{angles,PoseEstimator,drawing,LandmarkSmoother}.js   # ✅
│     ├─ pipeline/{ReplayFrameSource,CameraFrameSource}.js         # ✅
│     ├─ pipeline/AnalysisPipeline.js                              # ⏳ W3
│     ├─ analysis/{RollingBuffer,ExerciseVerifier}.js              # ✅
│     ├─ analysis/SquatStateMachine.js                             # ⏳ W3
│     ├─ analysis/{FormRuleEngine,MetricsEngine,FeedbackSelector}.js  # W4–5
│     ├─ calibration/{CalibrationFlow.jsx,baseline.js,anomaly.js}  # W7
│     ├─ api/{client,authApi,sessionApi}.js  auth/{AuthContext,ProtectedRoute}.jsx  # W6
│     ├─ components/{CameraView,...}.jsx  components/dashboard/*.jsx  # ✅ CameraView; dash W8
│     ├─ fixtures/*.json + GROUND_TRUTH.md                          # ✅
│     └─ __tests__/*.test.js                                        # ✅ (grows weekly)
├─ backend/app/{main,config,database,models,schemas,security}.py    # ⏳ backend track
│  ├─ routers/{auth,sessions,dashboard,calibration}.py
│  ├─ services/{validation,aggregation,form_score}.py
│  └─ tests/*.py
├─ tools/extract_landmarks.py            # ✅
├─ data/videos/*.webm + SOURCES.md       # ✅ (2 used clips committed)
└─ journals/JOURNAL_TEMPLATE.md + JOURNAL_WEEK{1,2}.md   # ✅  (3–9 pending)
```

---

## 7. How to run (current state)

**Frontend (Weeks 1–2 committed):**
```bash
cd frontend
npm install
# one-time: download the MediaPipe model to public/models/pose_landmarker_lite.task (see README)
npm run dev        # http://localhost:5173 — grant camera, see skeleton + live knee angle
npm run test       # Vitest — 41 passing
npm run build      # clean production build
npx playwright install --with-deps chromium && npm run e2e   # E2E smoke
```
**Backend (once the in-flight track is reviewed/committed at W6):**
```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload --port 8000   # /docs, /api/health
.venv/bin/pytest
```

---

## 8. Deferred user requests (do at the end of the build)

- **Create a PRIVATE GitHub repo and push** all committed work.
- Ensure the repo is **fully shareable / reproducible**: lockfiles, real fixtures,
  the 2 source clips + `SOURCES.md`, README run steps, and the model-download step
  are all committed. Deliberately excluded (regenerable/large, all documented):
  `node_modules/`, Python `.venv*/`, the `.task` model blob, `data/*.db`.
- At the end, give the user a **file-tree map of where all code lives**.

---

## 9. Resume checklist (next session)

1. `git log --oneline` → HEAD should be the **Week 3** commit (Weeks 1–3 done).
2. `git status` → only `backend/` should be untracked (built + 41 pytest green,
   held for the Week 6 commit). Verify with `cd backend && .venv/bin/pytest`.
3. **Next up = Week 4** (`FormRuleEngine` + `MetricsEngine`). Dispatch a builder
   per §2 workflow / §4 scope; it needs the rep segments from `getReps()` and
   small hand-derived valgus/lean edge fixtures. Then W5 (MVP) → W6 (wire backend)
   → W7 → W8 → W9.
4. Deferred end-of-build tasks live in §8 (private GitHub repo + push, shareability,
   file-tree map).
5. A deeper independent code-review of Week 3 was deferred at the stopping point —
   worth running on resume before building heavily on the FSM.

# Dev Journal — Week 1: Repo, camera feed, pose estimation & angle math

## 1. Week & focus
Stand up the project and prove the foundation of the whole system: a webcam feed
in the browser, MediaPipe Pose drawing 33 landmarks over it, and a **live joint
angle** computed from those landmarks. Maps to **BUILD_GUIDE Phase 0 + Phase 1**.

## 2. Goals for the week
- [x] Mono-repo scaffold (Vite + React in **JavaScript**, no TypeScript).
- [x] Webcam capture via `getUserMedia` rendering live video.
- [x] `PoseEstimator` wrapping MediaPipe **Tasks Vision** `PoseLandmarker`.
- [x] 33-landmark skeleton overlay on a `<canvas>`.
- [x] 2D dot-product joint-angle utility + unit tests.
- [x] A live knee-angle number that changes as you bend your knee.
- [x] Test infra: Vitest (unit) + Playwright (E2E smoke).

## 3. What I built
- `shared/exercise-config/landmarks.js` — the 33-landmark name→index map + the
  hard rule that `z` is never load-bearing (2D only).
- `shared/exercise-config/types.js` — JSDoc `@typedef`s for every contract
  (Landmark, Frame, FrameSource, AngleDef, ExerciseConfig, RepAngleHistory,
  SessionSummary, UserBaseline…) so later weeks build against a stable shape.
- `frontend/src/pose/angles.js` — `jointAngle2D`, `landmarkVisibleEnough`,
  `computeAngles` (pure geometry; degenerate-vector + missing-input guards).
- `frontend/src/pose/PoseEstimator.js` — `create()/detectForVideo()/close()`;
  throws a clear error when the model asset is missing.
- `frontend/src/pose/drawing.js` — draws skeleton lines + dots (normalized→pixel).
- `frontend/src/components/CameraView.jsx` — capture + rAF detect/draw loop +
  live left-knee readout + a real camera state machine
  (`requesting/denied/no-device/model-error/running`) with full unmount cleanup.
- `frontend/src/App.jsx`, `main.jsx`, `index.css` — minimal shell with a visible
  **"Not a medical device"** disclaimer (FR-019).
- Tests: `src/__tests__/angles.test.js` (13 cases), `playwright.config.js`,
  `e2e/smoke.spec.js`.

## 4. MVP & development-cycle notes
This is the bedrock beneath the Week-5 MVP: nothing is "usable" yet, but the two
riskiest unknowns — *can we get pose landmarks in-browser at all* and *can we turn
them into a meaningful number* — are now de-risked. Everything downstream (reps,
rules, feedback) is a transformation of the angle signal proven here. The vertical
slice starts here and grows one layer per week.

## 5. Challenges & resolutions
1. **MediaPipe WASM fileset path under Vite.** `FilesetResolver.forVisionTasks`
   needs a URL to the WASM binaries, and bundling those large binaries through
   Vite's dev/prod pipeline is fragile (asset handling + COOP/COEP quirks).
   *Fix:* point the resolver at the jsDelivr CDN **pinned to the exact
   `@mediapipe/tasks-vision@0.10.18`** that `package.json` uses, so the WASM and
   the JS API can never drift out of lockstep. *Trade-off / debt:* the WASM
   *runtime* now comes from a CDN. Video still never leaves the device (the
   privacy guarantee is about video, not static assets), but a fully
   self-contained/offline deploy should vendor the WASM locally — logged for
   **Week 9 hardening**.
2. **A missing/slow model must not blank the whole app.** Awaiting
   `PoseLandmarker.createFromOptions` before showing anything means a missing
   `.task` file = white screen. *Fix:* sequence it — request the camera first
   (shell + video render immediately), then lazy-init the estimator with its own
   try/catch → `model-error` state. The app is usable/legible even with no model.
3. **`getUserMedia` in headless Chromium (for Playwright).** Real webcam access
   isn't available in a sandboxed headless run. *Fix:* launch Chromium with
   `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` (synthetic
   video + auto-grant), which is more reliable than Playwright's `permissions`
   camera API across versions. Correct expected behavior: the fake device shows a
   synthetic pattern with no human, so the knee readout renders "—" — that's the
   *right* answer, not a failure.
4. **Normalized-vs-pixel coordinate drift on the canvas.** Landmarks are
   normalized [0,1], but the video's intrinsic size isn't known until
   `videoWidth/videoHeight` populate asynchronously. *Fix:* sync the canvas
   backing-store size to `video.videoWidth/videoHeight` every rAF tick (a no-op
   once stable) before scaling coords, instead of guessing a size at mount.

## 6. Key decisions & trade-offs
- **JavaScript, not TypeScript** (per direction) — kept structure via JSDoc
  typedefs so the contracts are still documented and editor-checkable.
- **2D-only angles from day one** — MediaPipe's `z` is unreliable on one camera
  (PRD §22); baking "2D only" into the very first utility prevents a whole class
  of later depth-related bugs.
- **Camera-first, model-second** init ordering — favors a legible UI over
  eager-loading correctness.

## 7. Testing evidence
- **Vitest: 13/13 passing, first run, no fixes needed.** Covers 180° (straight
  limb), 90°, 45°, 135°, degenerate/zero-length → NaN, missing point → NaN,
  visibility thresholds (incl. custom), and `computeAngles` name resolution
  (valid, unresolvable → NaN, non-array → `{}`).
- **Build:** `npm run build` clean (~326 KB JS / ~101 KB gzip).
- **Playwright: 1/1 passing** (`e2e/smoke.spec.js`) — app-root + disclaimer
  visible, no page errors, camera-state/knee-readout element appears.
  Hand-verified separately that the app reaches the full `running` state
  headlessly (WASM/XNNPACK loads, graph starts).
- Model `pose_landmarker_lite.task` (5.7 MB) downloaded locally so the app runs.

## 8. Open questions / risks
- Real-world angle accuracy is untested until we have **real** pose data — the
  data-prep track (real squat video → MediaPipe extraction) feeds Week 2+ tests.
- WASM-from-CDN is acceptable but is technical debt vs. the "self-contained"
  ideal (Week 9).

## 9. Next week
Week 2: temporal **smoothing** (EMA) to kill landmark jitter, a rolling buffer, a
coarse **exercise verifier**, and wiring the **real extracted-landmark replay**
source so the pipeline can be tested on real movement with no camera present.

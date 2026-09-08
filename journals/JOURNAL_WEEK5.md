# Dev Journal — Week 5: Feedback selection & live UI — RUNNABLE MVP

## 1. Week & focus
Deliver the **runnable client-side MVP** (`mvp-week5`). Orchestrate the entire analysis pipeline (`AnalysisPipeline`), prioritize and debounce coaching cues (`FeedbackSelector`), and render live rep counts and form cues directly onto the webcam video canvas in `CameraView`. Maps to **BUILD_GUIDE Phase 5**.

## 2. Goals for the week
- [x] `FeedbackSelector` — prioritize failed rules by severity (high > medium > low) and debounce cues to prevent visual flickering.
- [x] `AnalysisPipeline` — refactor into an orchestrator class coordinating smoothing, state machine, rules, metrics, and feedback.
- [x] `CameraView.jsx` integration — hook the live webcam feed and `requestAnimationFrame` loop to `AnalysisPipeline`, rendering HUD overlays on the canvas.
- [x] Backward compatibility — maintain named exports and helpers (`runSquatFixture`) so previous test suites continue passing.
- [x] Comprehensive testing — add `FeedbackSelector.test.js` and `AnalysisPipeline.test.js`; reach 55 passing Vitest tests.
- [x] Runnable MVP milestone achieved: real-time in-browser squat form analysis with zero backend dependency.

## 3. What I built
- `frontend/src/analysis/FeedbackSelector.js`:
  - Prioritizes failed rule results using a severity hierarchy: `high` (3) > `medium` (2) > `low` (1).
  - Implements temporal debouncing (`debounceMs = 1500` default): holds active cues for a minimum display duration so rapid transitions don't cause cue jitter.
  - Automatically clears cues after the debounce window when all rules pass.
- `frontend/src/pipeline/AnalysisPipeline.js`:
  - Class-based pipeline orchestrator instantiating `LandmarkSmoother`, `SquatStateMachine`, `FormRuleEngine`, `MetricsEngine`, and `FeedbackSelector`.
  - `processFrame(landmarks, timestampMs)`: smooths raw landmarks, advances the state machine, evaluates rules and computes metrics when a rep completes, and selects the top feedback cue.
  - Emits `{ state, repCount, feedback: { activeCue, severity }, metrics }`.
  - Restored backward-compatible `runSquatFixture` helper for headless replay test fixtures.
- `frontend/src/components/CameraView.jsx`:
  - Instantiates `AnalysisPipeline` in a `useRef` to maintain persistent state across React render cycles.
  - Feeds landmarks into `pipeline.processFrame()` inside the `requestAnimationFrame` loop.
  - Renders live HUD elements on canvas: `Reps: ${result.repCount}` in top-left, yellow alert text for `activeCue` at bottom-left, alongside the MediaPipe skeleton drawing.
  - Updated DOM attributes with `data-testid="camera-status"` and `data-testid="knee-angle-readout"` for test automation compatibility.
- Unit tests:
  - `frontend/src/__tests__/FeedbackSelector.test.js` (priority ordering and debounce timing).
  - `frontend/src/__tests__/AnalysisPipeline.test.js` (end-to-end frame processing contract).

## 4. MVP & development-cycle notes
**MAJOR MILESTONE: RUNNABLE MVP ACHIEVED.**
The core product promise is now fully realized in the browser:
1. User opens the application on `localhost:5173`.
2. Browser captures webcam video via `getUserMedia`.
3. MediaPipe Pose extracts 33 landmarks in real time (client-side, privacy-preserving).
4. The pipeline smooths jitter, tracks the squat rep cycle, counts valid reps, analyzes depth and torso posture upon rep completion, and displays actionable coaching feedback instantly.
5. No backend server or network connection required for live analysis.

## 5. Challenges & resolutions
1. **API divergence breaking existing test suites.**
   - **Problem:** Refactoring `AnalysisPipeline.js` from a procedural helper (`run`) into an instantiable class broke `SquatStateMachine.test.js` and other fixture tests that imported `runSquatFixture`.
   - **Root cause:** Overwriting the file stripped the legacy helper export.
   - **Fix:** Re-exported `runSquatFixture` as a named export alongside the `AnalysisPipeline` class, adapting it to feed frames into the state machine while retaining the expected signature.
2. **Canvas overlay performance and React re-render churn.**
   - **Problem:** Updating React component state (`setAnalysis`) at 30–60 FPS could induce render thrashing and visual stutter in the video feed.
   - **Root cause:** High-frequency React state updates trigger component reconciliation overhead.
   - **Fix:** Encapsulated the pipeline in a `useRef` and drew critical text overlays (`Reps: N`, feedback cues) directly into the HTML5 2D canvas context within the `requestAnimationFrame` loop. React state is updated cleanly without blocking the animation loop.

## 6. Key decisions & trade-offs
- **Single active cue display:** Rather than overwhelming the lifter with multiple simultaneous warnings (e.g. depth + torso lean + tempo), `FeedbackSelector` selects only the single highest-severity failure. One actionable correction at a time is far more effective for motor learning.
- **1500ms debounce window:** A 1.5-second debounce ensures the lifter has sufficient time to read the on-screen cue before it updates or fades.
- **Direct canvas HUD rendering:** Overlaying feedback text on canvas ensures video recording, screenshots, and display stay perfectly synchronized with the skeleton lines.

## 7. Testing evidence
- **Vitest: 55/55 passing tests** across 10 test suites:
  - `FeedbackSelector.test.js`: verifies high-severity preemption and 100ms debounce delay.
  - `AnalysisPipeline.test.js`: verifies that `processFrame` returns valid state, repCount, feedback, and metrics contracts.
  - Real-data fixture tests: `SquatStateMachine.test.js` continues to verify 2 good reps and 3 shallow reps on Wikimedia/CDC fixtures.
- **Vite build:** `npm run build` succeeds cleanly in under 600ms.
- **Playwright E2E:** `smoke.spec.js` verifies app shell, disclaimer, and canvas/readout elements render without console errors.

## 8. Open questions / risks
- **FrameSource iteration consistency:** Inconsistencies between `ReplayFrameSource` and live camera sources when iterating through frames (addressed in Week 6).
- **Audio feedback:** Visual cues work well when facing the camera, but lifters facing sideways would benefit from Web Audio API speech synthesis / beeps.

## 9. Next week
Week 6: Backend integration, authentication, and session persistence.
- Connect frontend to the FastAPI/SQLite backend (`POST /api/sessions`).
- Implement user authentication (register/login with JWT).
- Verify server-side form score recomputation and ownership isolation.

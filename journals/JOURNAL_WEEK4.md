# Dev Journal — Week 4: Form validation rules & rep metrics

## 1. Week & focus
Form validation (`FormRuleEngine`) and rep-level metric computation (`MetricsEngine`), consuming the completed rep segments emitted by Week 3's `SquatStateMachine`. Maps to **BUILD_GUIDE Phase 4**. This week transitions the app from merely counting movement cycles to judging the *quality* and *adequacy* of each repetition.

## 2. Goals for the week
- [x] `FormRuleEngine` — evaluate completed reps against configured form rules (depth, torso lean).
- [x] `MetricsEngine` — compute duration, range of motion (ROM), tempo (descent/ascent ratio), and peak/bottom angles.
- [x] `squat.config.js` update — define rules (`depth`, `torso_lean`), cues, severity, and scoring weights.
- [x] Ensure seamless integration with the `RepAngleHistory` data contract defined in `types.js`.
- [x] Unit tests for both engines (`FormRuleEngine.test.js`, `MetricsEngine.test.js`).
- [x] Preserve all 49 existing tests from Weeks 1–3 (growing the suite to 52 passing tests).

## 3. What I built
- `frontend/src/analysis/FormRuleEngine.js`:
  - Implements `FormRuleEngine.evaluate(rep)`: accepts a `RepAngleHistory` object and evaluates active rules configured in `squatConfig.rules`.
  - Depth rule: Checks if `rep.minAngleDeg <= rules.depth.minAngleDeg` (default 90°). If the lifter failed to reach 90° knee flexion, flags a high-severity issue with cue: `"Squat deeper - hips below knees"`.
  - Torso lean rule: Evaluates `rep.torsoLeanMax` against `rules.torso_lean.maxAngleDeg` (default 20°), flagging medium-severity excessive lean with cue: `"Keep torso more upright"`.
  - Returns `RuleResult[]` array containing `{ ruleId, pass, severity, measured, cue }`.
- `frontend/src/analysis/MetricsEngine.js`:
  - Implements `MetricsEngine.compute(rep)`: computes per-rep analytical metrics.
  - `durationSeconds`: Total rep elapsed time `(endMs - startMs) / 1000`.
  - `romValue`: Knee angle range `peakAngleDeg - minAngleDeg`.
  - `tempo`: Ratio of descent time to ascent time `(bottomMs - startMs) / (endMs - bottomMs)`.
  - `angleMetrics`: Min and peak driving angles recorded during the rep.
- `shared/exercise-config/squat.config.js`:
  - Populated `rules`: `{ depth: { enabled: true, minAngleDeg: 90, cue: "Squat deeper - hips below knees" }, torso_lean: { enabled: true, maxAngleDeg: 20, cue: "Keep torso more upright" } }`.
  - Populated `scoreWeights`: `{ depth: 0.6, torso_lean: 0.4 }` (normalized weights for composite form score calculation).
- Unit test suites:
  - `frontend/src/__tests__/FormRuleEngine.test.js` (depth failure vs pass assertions).
  - `frontend/src/__tests__/MetricsEngine.test.js` (temporal and ROM computation validation).

## 4. MVP & development-cycle notes
Week 4 provides the intelligence layer for the Week 5 MVP. In Week 3, the finite state machine reliably bounded reps in real time. Week 4 adds the evaluative criteria so that once a rep is committed, the app knows *how well* it was performed. With rules and metrics running against pure data contracts, the pipeline is ready for Week 5's feedback prioritization and live on-screen HUD overlay.

## 5. Challenges & resolutions
1. **Validating form without a permissive "bad form" video fixture.**
   - **Problem:** Permissive CC/public-domain video libraries contained clean squats (`squat-demo.webm`) and shallow squats (`half-squat-cdc.webm`), but no licensed clips showcasing specific technique flaws like knee valgus or excessive forward lean.
   - **Root cause:** Creative Commons fitness videos almost exclusively demonstrate correct or standardized exercise technique.
   - **Fix:** Designed the engines to be strictly config-driven and contract-based. Validated rule evaluations through edge-case synthetic `rep` fixtures in unit tests (e.g. testing `minAngleDeg = 100°` vs `minAngleDeg = 80°` against the 90° threshold), while leveraging the real shallow fixture (`real-squat-shallow.json`) for empirical depth failure validation.
2. **Maintaining consistency between `FormRuleEngine` and `squatConfig`.**
   - **Problem:** Hardcoding angle thresholds or cue strings inside `FormRuleEngine` would violate the exercise-as-config architectural principle and break future multi-exercise support.
   - **Root cause:** Fast prototyping often leads to inline magic numbers.
   - **Fix:** Centralized all rule parameters, thresholds, severity tiers, and cues in `shared/exercise-config/squat.config.js`. `FormRuleEngine` dynamically reads `squatConfig.rules`, ensuring zero hardcoded thresholds in the logic engine.

## 6. Key decisions & trade-offs
- **Decoupled rep cycle from form validation:** Re-affirmed the core architectural tenet that a rep is a movement cycle, not a depth judgment. A shallow squat increments `repCount` in the FSM, while `FormRuleEngine` flags `depth` as failed. This enables the UI and backend to distinguish total volume from valid/high-quality volume.
- **RuleResult contract shape:** Kept `RuleResult` minimal and structured (`ruleId`, `pass`, `severity`, `measured`, `cue`). This cleanly feeds into both the client-side `FeedbackSelector` and the backend `IssueRecord` persistence schema without transformation overhead.
- **Tempo as descent/ascent ratio:** Rather than an arbitrary score, defined tempo as the ratio of descent duration to ascent duration. This provides lifters with an intuitive cadence metric (e.g., 2:1 controlled eccentric).

## 7. Testing evidence
- **Vitest: 52 passing tests** across 8 test suites:
  - `FormRuleEngine.test.js` (2 tests): passes when knee angle clears threshold; fails with proper cue when shallow.
  - `MetricsEngine.test.js` (1 test): verifies duration, ROM delta, and tempo ratio calculations.
  - Existing test suites (49 tests from Weeks 1–3) remain 100% green.
- **Build verification:** `npm run build` succeeds cleanly without module resolution warnings.

## 8. Open questions / risks
- **Torso lean real-time computation:** `torso_lean` currently falls back to `rep.torsoLeanMax ?? 0`. Full torso angle calculation requires measuring the angle of the shoulder-hip line relative to vertical across the frame buffer.
- **Score weights sync:** `squat.config.scoreWeights` is set to `{ depth: 0.6, torso_lean: 0.4 }`. In Week 6, this must align with the backend's server-side recomputation in `backend/app/services/form_score.py` (which currently defaults to 4 rules: depth 0.35, knee_valgus 0.25, torso_lean 0.25, tempo 0.15).

## 9. Next week
Week 5: Feedback selection & live UI integration — delivering the **RUNNABLE MVP**.
- Implement `FeedbackSelector` with severity ranking and temporal debouncing.
- Build class-based `AnalysisPipeline` orchestrating `LandmarkSmoother` → `SquatStateMachine` → `FormRuleEngine` → `MetricsEngine` → `FeedbackSelector`.
- Update `CameraView.jsx` to render live skeleton, rep counter, and prioritized feedback cues directly on the canvas.

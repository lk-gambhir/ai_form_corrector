# Dev Journal — Week 3: Config-driven squat rep state machine

## 1. Week & focus
Count squat reps from the real, smoothed landmark stream — reliably, with no
double-counts and no phantom reps — driven entirely by a single exercise config
object. Maps to **BUILD_GUIDE Phase 3**. This is the first week the app produces
the number a lifter actually cares about ("how many reps"), and it does so
against **human-counted ground truth** on real video.

## 2. Goals for the week
- [x] `squat.config.js` — the extensibility-linchpin `ExerciseConfig` (states, hysteresis thresholds, min-frames, composite knee signal).
- [x] `SquatStateMachine` — STANDING→DESCENDING→BOTTOM→ASCENDING→STANDING FSM.
- [x] Rep counter + transition log + per-rep segments (`getReps()`) for Week 4.
- [x] Prove **good=2 / shallow=3** headlessly on the real fixtures.
- [x] Anti-oscillation (hysteresis + min-frames) and dropout-hold, both tested.

## 3. What I built
- `shared/exercise-config/squat.config.js` — `squatConfig`: driving angles
  (left/right knee), a `knee` **composite** signal (average both legs, fall back
  to whichever is visible — mirrors `ExerciseVerifier`), and
  `repCycleThresholds { down:140°, up:155°, minFrames:3 }`.
- `frontend/src/analysis/SquatStateMachine.js` — the FSM: resolves the composite
  signal per frame, decides the supported target state, debounces every
  transition by `minFrames`, commits a rep only on `ASCENDING→STANDING`, and
  emits per-rep `{startMs, bottomMs, endMs, minAngleDeg, peakAngleDeg, series}`.
- `frontend/src/pipeline/AnalysisPipeline.js` — a thin `run(source,{onFrame})`
  pump + `runSquatFixture()` helper wiring `ReplayFrameSource → LandmarkSmoother
  → SquatStateMachine` exactly as the live path will.
- `frontend/src/__tests__/SquatStateMachine.test.js` — 8 tests.
- Additive `types.js` typedefs: `CompositeAngleDef`, `RepCycleThresholds`, and
  optional `compositeAngles`/`repCycleThresholds` on `ExerciseConfig`, plus
  `bottomMs`/`minAngleDeg`/`peakAngleDeg` on `RepAngleHistory`. Nothing renamed
  or removed — no existing import breaks.

## 4. MVP & development-cycle notes
Still one layer below the Week-5 MVP, but rep-counting is the backbone the MVP's
on-screen counter and Week 4's per-rep form analysis both hang off. Because it
runs through the same `FrameSource` the live camera uses, the "does it count
right" question is now answered deterministically on real recorded movement every
test run — no need to physically squat to regression-test the counter.

## 5. Challenges & resolutions
1. **"Rep = movement cycle, not depth" had to be enforced in the thresholds, not
   just asserted.** The good clip bottoms at ~56–67° (full depth); the shallow
   clip only reaches ~87–110° (half-squat). A naive "bottom = knee < 90°" would
   have silently dropped every half-squat rep. Resolved by tuning the bottom
   threshold to **140°** — far above both clips' bottoms, so a *meaningful
   descent* (not a *deep* one) enters BOTTOM. Depth adequacy is deferred to a
   Week 4 form rule that consumes the rep's `minAngleDeg`.
2. **Separating real reps from the shallow clip's non-squat warmup and its
   cut-off final rep.** The clip opens with a ~6s arm-raise where the knee angle
   never dips below ~150°, and ends with a 4th descent truncated mid-recovery.
   The up-threshold **155°** means the warmup never leaves STANDING (zero
   transitions), and because a rep only commits on the *return* to STANDING, the
   truncated 4th descent — which reaches BOTTOM but never re-crosses 155° before
   the clip ends — is correctly left parked and **not counted**. Verified via the
   transition log: **4 BOTTOM entries but only 3 completed cycles.**
3. **A low-visibility stretch that GROUND_TRUTH.md didn't mention.** Simulating
   the *smoothed* output (not just eyeballing fixture length) surfaced an ~88-frame
   run in the shallow clip where a leg's ankle visibility falls to ~0.06 — not a
   full dropout, but not trustworthy either. Resolved by generalizing "unusable
   frame" to include "no leg triplet clears the visibility gate", so the machine
   *holds* through it (no phantom transition, no lost in-progress rep) rather than
   feeding a garbage angle into the FSM.
4. **Proving hysteresis actually helps.** The 5-state cycle already makes
   over-counting structurally hard (a 2nd rep needs a full 2nd BOTTOM traversal),
   so the honest demonstration of `minFrames` is that it suppresses *transition-log
   flapping* from single-frame noise — the jitter test feeds 6 adversarial frames
   near a threshold and asserts the log stays at exactly the intended entries.

## 6. Key decisions & trade-offs
- **FSM reads `repCycleThresholds` directly** rather than generically
  interpreting `states[].enterWhen`. `states[]` is populated for typedef-shape
  fidelity (and future Deadlift/Bench reuse) but is documentation-only today.
  Simpler and directly testable now; flagged as a real rewrite point **if** a
  later exercise needs a generic StateDef interpreter.
- **Composite knee signal averages both legs** (fallback to one) — robust to a
  single occluded side, consistent with the verifier.
- **Per-rep `series`/`peakAngleDeg` cover the DESCENDING→ASCENDING window only**
  (not the standing holds) — reasonable, to be confirmed against Week 4's rule
  needs.

## 7. Testing evidence
- **Vitest: 49/49 passing** (Weeks 1–2's 41 + **8 new**). On the REAL chain
  (ReplayFrameSource→LandmarkSmoother→SquatStateMachine): `real-squat-good.json`
  → **repCount 2** (bottoms ≈43°, 67°); `real-squat-shallow.json` → **repCount 3**
  (bottoms ≈90°, 110°, 94° — closely tracks GROUND_TRUTH.md's ~87/110/94°), with
  the warmup and truncated 4th rep correctly uncounted. Plus synthetic tests for
  jitter/oscillation and a dropout mid-descent (no phantom, no lost rep).
- **Threshold robustness:** a sweep over down∈[135,150], up∈[155,165],
  minFrames∈[2,3] reproduced good=2/shallow=3 in every combination — not a
  fragile single-point fit.
- **Build:** `npm run build` clean (~326 KB JS / ~101 KB gzip, 627 ms).
- **Playwright:** no new UI this week; Week 1 smoke remains green. Live-UI E2E
  lands in Week 5 with the on-screen rep counter.

## 8. Open questions / risks
- Fixed-α EMA (from Week 2) means the smoothed bottom angles differ slightly from
  GROUND_TRUTH.md's unsmoothed derivation (~43/67° vs ~56/65°) — same rep counts,
  but Week 4's depth rule should judge against *this app's* smoothed values, not
  the doc's, to stay self-consistent.
- Precise debounce-counter semantics across a dropout that straddles a pending
  (uncommitted) transition are left intentionally loose (either reset or preserve
  is defensible) — revisit if a later week depends on exact pending-counter behavior.

## 9. Next week
Week 4: `FormRuleEngine` (depth / knee-valgus / torso-lean, each pass/fail +
severity) and `MetricsEngine` (ROM, tempo, bottom angles per rep), consuming the
rep segments this machine emits. Because no permissively-licensed *bad-form* clip
exists, valgus/lean will be covered by small **hand-derived edge fixtures** built
from real frames, alongside the real shallow clip for the depth rule.

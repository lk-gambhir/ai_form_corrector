/**
 * Squat ExerciseConfig — the extensibility linchpin for the config-driven
 * rep FSM (Week 3). See types.js for the shape contracts this object is
 * built against (ExerciseConfig, AngleDef, CompositeAngleDef, StateDef,
 * RepCycleThresholds). Deadlift/Bench (Week 8+) will be stub siblings of
 * this same shape.
 *
 * CRITICAL design principle (see also SquatStateMachine.js): a rep is a
 * MOVEMENT CYCLE (standing -> descended meaningfully -> bottomed out ->
 * returned to standing), not a depth judgment. Depth adequacy (shallow vs
 * full squat) is a Week 4 FORM RULE, not a rep-existence question — so the
 * thresholds below are tuned to catch a genuine half-squat exactly the same
 * as a full-depth squat, and are deliberately nowhere near the ~56-65deg
 * true-bottom range real-squat-good.json reaches.
 *
 * Threshold tuning (see journals/JOURNAL_WEEK3.md for the full derivation):
 * simulated this exact FSM (decideTransitionTarget in SquatStateMachine.js)
 * offline against both real fixtures' actual smoothed knee-angle traces
 * before picking these numbers. downThresholdDeg=140 / upThresholdDeg=155 /
 * minFrames=3 reproduces the ground-truth rep counts exactly:
 *   - real-squat-good.json -> 2 reps (bottoms ~43deg, ~67deg after this
 *     app's own EMA smoothing + left/right averaging — deeper than
 *     GROUND_TRUTH.md's independently-derived ~56/~65deg because that doc's
 *     method used a different/no smoothing pass, but same 2 reps)
 *   - real-squat-shallow.json -> 3 reps (bottoms ~90deg, ~110deg, ~94deg,
 *     matching GROUND_TRUTH.md's ~87/~110/~94deg closely), the ~6s
 *     arm-raise warmup (never dips below 155) correctly produces zero
 *     transitions out of STANDING, and the 4th, truncated descent (starts
 *     ~t=32.8s, reaches BOTTOM ~t=33.1s, clip ends mid-recovery at ~140deg)
 *     correctly leaves the machine parked in BOTTOM/ASCENDING — never
 *     recommits to STANDING, so it is never counted.
 * This threshold pair is also robust: a wide sweep (down in [135,150], up
 * in [155,165], minFrames in [2,3]) reproduced 2/3 in every combination
 * tried, so this isn't a fragile single-point fit.
 */

/** @type {import("./types.js").AngleDef[]} */
const drivingAngles = [
  { id: "knee_left", points: ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"], plane: "2d" },
  { id: "knee_right", points: ["RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE"], plane: "2d" },
];

/** @type {import("./types.js").CompositeAngleDef[]} */
const compositeAngles = [
  // The logical rep-counting signal: average left/right knee angle when
  // both legs are visible-enough; fall back to whichever leg is visible
  // when only one is (mirrors ExerciseVerifier.js's LEG_TRIPLETS handling).
  { id: "knee", from: ["knee_left", "knee_right"] },
];

/** @type {import("./types.js").StateDef[]} */
const states = [
  // Documentation/typedef-shape mirror of the thresholds below, expressed
  // as single EnterCondition-per-state (see types.js). SquatStateMachine
  // does not interpret these generically today (see its header comment for
  // why) — it reads `repCycleThresholds` directly — but this keeps the
  // config honest against the shared StateDef contract for future reuse.
  { name: "STANDING", enterWhen: { signal: "knee", op: ">", value: 155, hysteresis: 7.5, minFrames: 3 } },
  { name: "DESCENDING", enterWhen: { signal: "knee", op: "<", value: 155, hysteresis: 7.5, minFrames: 3 } },
  { name: "BOTTOM", enterWhen: { signal: "knee", op: "<", value: 140, hysteresis: 7.5, minFrames: 3 } },
  { name: "ASCENDING", enterWhen: { signal: "knee", op: ">", value: 140, hysteresis: 7.5, minFrames: 3 } },
];

/** @type {import("./types.js").ExerciseConfig} */
export const squatConfig = {
  id: "squat",
  label: "Squat",
  displayName: "Squat",
  enabled: true,
  drivingAngles,
  compositeAngles,
  verification: { dominantMotion: "hip_knee", minAmplitudeDeg: 20 },
  states,
  repCycle: ["STANDING", "DESCENDING", "BOTTOM", "ASCENDING"],
  repCycleThresholds: {
    signal: "knee",
    downThresholdDeg: 140, // must dip below this to be considered BOTTOM (reaches into DESCENDING's zone but not out of it)
    upThresholdDeg: 155, // must rise back above this to close a rep and return to STANDING
    minFrames: 3, // consecutive good frames a transition condition must hold before it commits — kills single-frame jitter/oscillation
  },
  rules: [], // Week 4
  tempoBounds: { minSec: 0.5, maxSec: 12 }, // generous placeholder; Week 4/7 will tune against real tempo data
  scoreWeights: {}, // Week 4
  // Visibility gate used when resolving compositeAngles (per-leg triplet
  // must clear this to be trusted this frame) — mirrors ExerciseVerifier's
  // default. Not part of the shared ExerciseConfig typedef (squat-specific
  // knob); SquatStateMachine also accepts an override via its constructor.
  visibilityThreshold: 0.5,
};

export default squatConfig;

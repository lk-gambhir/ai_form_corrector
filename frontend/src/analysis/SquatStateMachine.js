/**
 * Config-driven squat rep-counting finite state machine (Week 3).
 *
 * CRITICAL design principle: a rep is a MOVEMENT CYCLE, not a depth
 * judgment. This machine detects "descended meaningfully from standing ->
 * reached a bottom region -> returned to standing", regardless of how deep
 * the bottom was. Depth adequacy (shallow vs full) is a Week 4 form-rule
 * concern that consumes the rep boundaries this machine emits — it is NOT
 * decided here. See shared/exercise-config/squat.config.js for the tuned
 * thresholds and the fixture-derived numbers that justify them.
 *
 * State machine shape (squatConfig.repCycle): STANDING -> DESCENDING ->
 * BOTTOM -> ASCENDING -> STANDING, driven by one composite signal (the
 * config's `repCycleThresholds.signal`, "knee" for squat) with a two-
 * threshold hysteresis band (downThresholdDeg < upThresholdDeg) plus a
 * `minFrames` consecutive-frame debounce on every transition:
 *
 *   STANDING   --angle < up, held minFrames-->      DESCENDING
 *   DESCENDING --angle < down, held minFrames-->    BOTTOM
 *   DESCENDING --angle >= up, held minFrames-->     STANDING  (bounced back before reaching bottom -> NOT a rep)
 *   BOTTOM     --angle >= down, held minFrames-->   ASCENDING
 *   ASCENDING  --angle >= up, held minFrames-->     STANDING  (rep commits: repCount++)
 *   ASCENDING  --angle < down, held minFrames-->    BOTTOM    (wobble back down; still the same in-progress rep)
 *
 * Anti-oscillation: the down/up gap means noise sitting right at a single
 * threshold can't flicker the state (it would have to cross the *other*
 * threshold to move again), and minFrames means a single noisy frame can't
 * commit a transition by itself — both are exercised explicitly in
 * SquatStateMachine.test.js.
 *
 * Dropout / low-confidence handling: a frame is "unusable" when landmarks
 * are empty/short (a whole-frame dropout, per LandmarkSmoother's `[]`
 * convention) OR when the composite signal can't be resolved because
 * neither contributing leg triplet clears the visibility gate this frame
 * (this also transparently covers LandmarkSmoother's "all-stale" whole-
 * frame-dropout representation, since a fully-stale frame reports
 * visibility 0 on every landmark). On an unusable frame, update() returns
 * immediately without touching state, the debounce counters, or any
 * in-progress rep's min/max tracking — i.e. it holds. This is what
 * prevents both a phantom transition (noise-triggered) and a lost rep
 * (a dropout mid-descent doesn't reset progress, it just pauses).
 */

import { LANDMARK_COUNT, POSE_LANDMARKS } from "@shared/exercise-config/landmarks.js";
import { computeAngles, landmarkVisibleEnough } from "@/pose/angles.js";

/**
 * @param {import("@shared/exercise-config/types.js").Landmark[]} landmarks
 * @param {import("@shared/exercise-config/types.js").AngleDef} angleDef
 * @param {number} visibilityThreshold
 * @returns {boolean}
 */
function tripletVisible(landmarks, angleDef, visibilityThreshold) {
  return angleDef.points.every((name) => {
    const idx = POSE_LANDMARKS[name];
    if (idx === undefined) return false;
    return landmarkVisibleEnough(landmarks[idx], visibilityThreshold);
  });
}

export class SquatStateMachine {
  /**
   * @param {import("@shared/exercise-config/types.js").ExerciseConfig} config  e.g. squatConfig
   * @param {{visibilityThreshold?: number}} [options]  overrides config.visibilityThreshold
   */
  constructor(config, { visibilityThreshold } = {}) {
    if (!config || !Array.isArray(config.drivingAngles) || !config.repCycleThresholds) {
      throw new Error("SquatStateMachine: config must be an ExerciseConfig with drivingAngles + repCycleThresholds");
    }
    this.config = config;
    this.visibilityThreshold = visibilityThreshold ?? config.visibilityThreshold ?? 0.5;

    const { signal, downThresholdDeg, upThresholdDeg, minFrames } = config.repCycleThresholds;
    this._signal = signal;
    this._down = downThresholdDeg;
    this._up = upThresholdDeg;
    this._minFrames = minFrames;

    this._byId = new Map(config.drivingAngles.map((def) => [def.id, def]));
    this._composites = config.compositeAngles ?? [];

    /** @type {"STANDING"|"DESCENDING"|"BOTTOM"|"ASCENDING"} */
    this.state = config.states?.[0]?.name ?? "STANDING";
    this.repCount = 0;

    this._pendingTarget = null;
    this._pendingCount = 0;

    /** @type {Array<{fromState:string, toState:string, timestampMs:number, kneeAngle:number}>} */
    this._transitionLog = [];

    /** @type {import("@shared/exercise-config/types.js").RepAngleHistory[]} */
    this._reps = [];

    this._resetInProgressRep();
  }

  _resetInProgressRep() {
    this._curStartMs = null;
    this._curMin = Infinity;
    this._curMinMs = null;
    this._curSeries = []; // Array<{t:number, angle:number}>
  }

  /**
   * Resolve the configured composite signal (e.g. "knee") for this frame,
   * left/right-averaging or falling back exactly like ExerciseVerifier.
   *
   * @param {import("@shared/exercise-config/types.js").Landmark[]} landmarks  exactly LANDMARK_COUNT long
   * @returns {number} the composite angle in degrees, or NaN if unusable this frame
   */
  _resolveSignal(landmarks) {
    const composite = this._composites.find((c) => c.id === this._signal);

    // No composite configured for this signal id: treat the signal id as a
    // plain AngleDef id directly (single-leg / non-bilateral config).
    if (!composite) {
      const def = this._byId.get(this._signal);
      if (!def) return NaN;
      if (!tripletVisible(landmarks, def, this.visibilityThreshold)) return NaN;
      const raw = computeAngles(landmarks, [def]);
      return raw[def.id];
    }

    const visibleIds = composite.from.filter((id) => {
      const def = this._byId.get(id);
      return def && tripletVisible(landmarks, def, this.visibilityThreshold);
    });
    if (visibleIds.length === 0) return NaN;

    const defs = visibleIds.map((id) => this._byId.get(id));
    const raw = computeAngles(landmarks, defs);
    const values = visibleIds.map((id) => raw[id]).filter((v) => !Number.isNaN(v));
    if (values.length === 0) return NaN;

    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * @param {string} state
   * @param {number} angle
   * @returns {string} the state `angle` currently supports (may equal `state`, meaning "stay")
   */
  _decideTarget(state, angle) {
    const { _down: down, _up: up } = this;
    switch (state) {
      case "STANDING":
        return angle < up ? "DESCENDING" : "STANDING";
      case "DESCENDING":
        if (angle < down) return "BOTTOM";
        if (angle >= up) return "STANDING"; // bounced back without reaching bottom -> not a rep
        return "DESCENDING";
      case "BOTTOM":
        return angle >= down ? "ASCENDING" : "BOTTOM";
      case "ASCENDING":
        if (angle >= up) return "STANDING"; // rep commits
        if (angle < down) return "BOTTOM"; // wobble back down, same in-progress rep
        return "ASCENDING";
      default:
        return state;
    }
  }

  /**
   * Advance the FSM by one frame. No-ops (holds state) on an unusable frame.
   * @param {{landmarks: import("@shared/exercise-config/types.js").Landmark[], timestampMs: number}} frame
   */
  update({ landmarks, timestampMs }) {
    if (!Array.isArray(landmarks) || landmarks.length < LANDMARK_COUNT) {
      return; // whole-frame dropout: hold state, touch nothing
    }

    const angle = this._resolveSignal(landmarks);
    if (Number.isNaN(angle)) {
      return; // no leg triplet cleared the visibility gate this frame: hold state
    }

    // Track this frame's angle into the in-progress rep BEFORE deciding the
    // transition, so the frame that *commits* a transition out of a mid-rep
    // state is included, but the frame that commits STANDING->DESCENDING is
    // seeded separately below (it's the first sample of the new rep).
    if (this.state !== "STANDING") {
      this._curSeries.push({ t: timestampMs, angle });
      if (angle < this._curMin) {
        this._curMin = angle;
        this._curMinMs = timestampMs;
      }
    }

    const target = this._decideTarget(this.state, angle);

    if (target === this.state) {
      this._pendingTarget = null;
      this._pendingCount = 0;
      return;
    }

    if (target === this._pendingTarget) {
      this._pendingCount += 1;
    } else {
      this._pendingTarget = target;
      this._pendingCount = 1;
    }

    if (this._pendingCount < this._minFrames) {
      return; // not held long enough yet — no phantom transition
    }

    // Commit the transition.
    const fromState = this.state;
    this.state = target;
    this._pendingTarget = null;
    this._pendingCount = 0;
    this._transitionLog.push({ fromState, toState: target, timestampMs, kneeAngle: angle });

    if (target === "DESCENDING") {
      // Start of a new rep attempt.
      this._curStartMs = timestampMs;
      this._curMin = angle;
      this._curMinMs = timestampMs;
      this._curSeries = [{ t: timestampMs, angle }];
      return;
    }

    if (target === "STANDING") {
      if (fromState === "ASCENDING") {
        // Genuine rep: entered BOTTOM at some point on the way here.
        this.repCount += 1;
        const seriesValues = this._curSeries.map((s) => s.angle);
        this._reps.push({
          repNumber: this.repCount,
          startMs: this._curStartMs,
          endMs: timestampMs,
          bottomMs: this._curMinMs,
          minAngleDeg: this._curMin,
          peakAngleDeg: seriesValues.length ? Math.max(...seriesValues) : angle,
          series: { [this._signal]: seriesValues },
        });
      }
      // Either way (genuine rep, or DESCENDING bounce-back that never
      // reached BOTTOM), the in-progress rep tracking resets.
      this._resetInProgressRep();
    }
  }

  /** @returns {Array<{fromState:string, toState:string, timestampMs:number, kneeAngle:number}>} */
  getTransitionLog() {
    return this._transitionLog.slice();
  }

  /** @returns {import("@shared/exercise-config/types.js").RepAngleHistory[]} */
  getReps() {
    return this._reps.slice();
  }

  reset() {
    this.state = this.config.states?.[0]?.name ?? "STANDING";
    this.repCount = 0;
    this._pendingTarget = null;
    this._pendingCount = 0;
    this._transitionLog = [];
    this._reps = [];
    this._resetInProgressRep();
  }
}

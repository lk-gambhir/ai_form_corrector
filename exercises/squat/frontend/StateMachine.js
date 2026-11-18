// Config-driven rep-counting finite state machine for squats.
import { LANDMARK_COUNT, POSE_LANDMARKS } from "../../../shared/exercise-config/landmarks.js";
import { bodyYawDeg, computeAngles, kneeAnkleRatio, landmarkVisibleEnough, torsoLeanDeg } from "../../../frontend/src/pose/angles.js";

// Front view: how long the "standing hip height" reference is remembered.
const STANDING_HEIGHT_WINDOW_MS = 10_000;

// Checks if all points of an angle definition meet visibility threshold.
function tripletVisible(landmarks, angleDef, visibilityThreshold) {
  return angleDef.points.every((name) => {
    const idx = POSE_LANDMARKS[name];
    if (idx === undefined) return false;
    return landmarkVisibleEnough(landmarks[idx], visibilityThreshold);
  });
}

export class SquatStateMachine {
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

    // Knee valgus (knee-to-ankle ratio) is only measurable from a front view.
    const valgusRule = config.rules?.knee_valgus;
    this._trackValgus = Boolean(valgusRule?.enabled);
    this._maxYawDeg = valgusRule?.maxBodyYawDeg ?? 25;
    this._hipHeights = [];

    this._byId = new Map(config.drivingAngles.map((def) => [def.id, def]));
    this._composites = config.compositeAngles ?? [];

    const cycle = config.repCycle || ["STANDING", "DESCENDING", "BOTTOM", "ASCENDING"];
    this._startState = cycle[0];
    this._motionState = cycle[1];
    this._inflectionState = cycle[2];
    this._returnState = cycle[3];

    this.state = config.states?.[0]?.name ?? this._startState;
    this.repCount = 0;

    this._pendingTarget = null;
    this._pendingCount = 0;
    this._transitionLog = [];
    this._reps = [];
    this._invalidSinceMs = null;

    this._resetInProgressRep();
  }

  // Resets in-progress rep tracking variables.
  _resetInProgressRep() {
    this._curStartMs = null;
    this._curMin = Infinity;
    this._curMinMs = null;
    this._curSeries = [];
    this._curTorsoLeanMax = null;
    this._curKasr = null;
    this._curKasrKneeAngle = Infinity;
  }

  // Keeps the knee-to-ankle ratio from the deepest front-view frame of the
  // rep - peak knee flexion, the instant used by Mizner et al. (2012).
  _trackKneeAnkleRatio(landmarks, kneeAngle) {
    if (!this._trackValgus || !(kneeAngle < this._curKasrKneeAngle)) return;
    const ratio = kneeAnkleRatio(landmarks, this.visibilityThreshold, this._maxYawDeg);
    if (Number.isFinite(ratio)) {
      this._curKasr = ratio;
      this._curKasrKneeAngle = kneeAngle;
    }
  }

  // True when shoulders and hips are square enough to the camera for the
  // front-view measures (knee-to-ankle ratio, hip-drop rep signal).
  _isFrontView(landmarks) {
    return this._trackValgus && bodyYawDeg(landmarks) <= this._maxYawDeg;
  }

  // Front-view rep signal. Facing the camera, the thigh points at the lens,
  // so the 2D hip-knee-ankle angle stays near 180 deg even in a deep squat and
  // reps would never be counted. Instead, estimate an equivalent knee angle
  // from how far the hips have dropped: h = current hip height above the
  // ankles / standing hip height (max over the last 10 s). Assuming equal
  // thigh and shin length and a vertical shin, h = (1 + cos t) / 2 where t is
  // the thigh's angle from vertical, and knee angle = 180 - t. So standing
  // (h = 1) -> 180 deg and thighs parallel (h = 0.5) -> 90 deg.
  // [heuristic] Geometric approximation, not from a source; validate on real
  // front-view footage. Uses only vertical distances, so aspect ratio cancels.
  _frontViewKneeAngle(landmarks, timestampMs) {
    const names = ["LEFT_HIP", "RIGHT_HIP", "LEFT_ANKLE", "RIGHT_ANKLE"];
    if (!names.every((n) => landmarkVisibleEnough(landmarks[POSE_LANDMARKS[n]], this.visibilityThreshold))) return NaN;
    const y = (n) => landmarks[POSE_LANDMARKS[n]].y;
    const height = (y("LEFT_ANKLE") + y("RIGHT_ANKLE")) / 2 - (y("LEFT_HIP") + y("RIGHT_HIP")) / 2;
    if (!(height > 0)) return NaN;
    this._hipHeights.push({ t: timestampMs, height });
    while (this._hipHeights.length && this._hipHeights[0].t < timestampMs - STANDING_HEIGHT_WINDOW_MS) {
      this._hipHeights.shift();
    }
    const standing = Math.max(...this._hipHeights.map((h) => h.height));
    const h = Math.min(1, height / standing);
    const thighFromVertical = Math.acos(Math.max(-1, Math.min(1, 2 * h - 1)));
    return 180 - (thighFromVertical * 180) / Math.PI;
  }

  // Records the torso lean of an in-rep frame (ignored when not visible).
  // Forward lean happens in the sagittal plane, so it cannot be seen from the
  // front: front-view frames are skipped and lean is reported as not measured.
  _trackTorsoLean(landmarks) {
    if (this._isFrontView(landmarks)) return;
    const lean = torsoLeanDeg(landmarks, this.visibilityThreshold);
    if (Number.isFinite(lean) && (this._curTorsoLeanMax == null || lean > this._curTorsoLeanMax)) {
      this._curTorsoLeanMax = lean;
    }
  }

  // Resolves the composite driving angle for the current frame.
  _resolveSignal(landmarks, timestampMs) {
    if (this._isFrontView(landmarks)) {
      const frontAngle = this._frontViewKneeAngle(landmarks, timestampMs);
      if (Number.isFinite(frontAngle)) return frontAngle;
    }
    const composite = this._composites.find((c) => c.id === this._signal);

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

  // Determines next candidate state based on current angle and hysteresis thresholds.
  _decideTarget(state, angle) {
    const { _down: down, _up: up } = this;
    switch (state) {
      case "STANDING":
        return angle < up ? "DESCENDING" : "STANDING";
      case "DESCENDING":
        if (angle < down) return "BOTTOM";
        if (angle >= up) return "STANDING";
        return "DESCENDING";
      case "BOTTOM":
        return angle >= down ? "ASCENDING" : "BOTTOM";
      case "ASCENDING":
        if (angle >= up) return "STANDING";
        if (angle < down) return "BOTTOM";
        return "ASCENDING";
      default:
        return state;
    }
  }

  // Advances the state machine with one frame of landmarks.
  update({ landmarks, timestampMs }) {
    if (!Number.isFinite(timestampMs)) {
      return;
    }

    const angle = Array.isArray(landmarks) && landmarks.length >= LANDMARK_COUNT
      ? this._resolveSignal(landmarks, timestampMs)
      : Number.NaN;
    if (!Number.isFinite(angle)) {
      this._pendingTarget = null;
      this._pendingCount = 0;
      this._invalidSinceMs ??= timestampMs;
      if (this.state !== this._startState && timestampMs - this._invalidSinceMs > 1200) {
        this.state = this._startState;
        this._resetInProgressRep();
      }
      return;
    }
    this._invalidSinceMs = null;

    // Track frame samples into active rep.
    if (this.state !== this._startState) {
      this._curSeries.push({ t: timestampMs, angle });
      this._trackTorsoLean(landmarks);
      this._trackKneeAnkleRatio(landmarks, angle);
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
      return;
    }

    // Commit state transition.
    const fromState = this.state;
    this.state = target;
    this._pendingTarget = null;
    this._pendingCount = 0;
    this._transitionLog.push({ fromState, toState: target, timestampMs, kneeAngle: angle });

    if (target === this._motionState) {
      this._curStartMs = timestampMs;
      this._curMin = angle;
      this._curMinMs = timestampMs;
      this._curSeries = [{ t: timestampMs, angle }];
      this._curTorsoLeanMax = null;
      this._curKasr = null;
      this._curKasrKneeAngle = Infinity;
      this._trackTorsoLean(landmarks);
      this._trackKneeAnkleRatio(landmarks, angle);
      return;
    }

    if (target === this._startState) {
      if (fromState === this._returnState) {
        this.repCount += 1;
        const seriesValues = this._curSeries.map((s) => s.angle);
        this._reps.push({
          repNumber: this.repCount,
          startMs: this._curStartMs,
          endMs: timestampMs,
          bottomMs: this._curMinMs,
          minAngleDeg: this._curMin,
          peakAngleDeg: seriesValues.length ? Math.max(...seriesValues) : angle,
          torsoLeanMax: this._curTorsoLeanMax,
          // Present only when a front-view frame was available in this rep.
          // Each key is present only when that measure was possible in this
          // rep (front view for the ratio, non-front view for torso lean).
          angleMetrics: {
            ...(Number.isFinite(this._curKasr) ? { kneeAnkleRatio: Number(this._curKasr.toFixed(3)) } : {}),
            ...(Number.isFinite(this._curTorsoLeanMax) ? { torsoLeanMaxDeg: Number(this._curTorsoLeanMax.toFixed(1)) } : {}),
          },
          series: { [this._signal]: seriesValues },
        });
      }
      this._resetInProgressRep();
    }
  }

  // Returns a copy of the state transition history.
  getTransitionLog() {
    return this._transitionLog.slice();
  }

  // Returns a copy of completed reps.
  getReps() {
    return this._reps.slice();
  }

  // Updates rep detection thresholds dynamically from calibrated baseline ROM.
  updateThresholds({ downThresholdDeg, upThresholdDeg }) {
    if (typeof downThresholdDeg === "number" && !Number.isNaN(downThresholdDeg)) {
      this._down = downThresholdDeg;
    }
    if (typeof upThresholdDeg === "number" && !Number.isNaN(upThresholdDeg)) {
      this._up = upThresholdDeg;
    }
  }

  // Resets the state machine to initial standing state.
  reset() {
    this.state = this.config.states?.[0]?.name ?? this._startState;
    this.repCount = 0;
    this._pendingTarget = null;
    this._pendingCount = 0;
    this._transitionLog = [];
    this._reps = [];
    this._invalidSinceMs = null;
    this._hipHeights = [];
    this._resetInProgressRep();
  }
}

export const ExerciseStateMachine = SquatStateMachine;

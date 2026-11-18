import { POSE_LANDMARKS, LANDMARK_COUNT } from "@shared/exercise-config/landmarks.js";
import { jointAngle2D, landmarkVisibleEnough } from "@/pose/angles.js";

function resolveAngle(landmarks, points, visibilityThreshold) {
  if (!Array.isArray(points) || points.length !== 3) return null;
  const indices = points.map((name) => POSE_LANDMARKS[name]);
  if (indices.some((index) => index == null)) return null;
  const [a, b, c] = indices.map((index) => landmarks[index]);
  if (![a, b, c].every((point) => landmarkVisibleEnough(point, visibilityThreshold))) return null;
  const angle = jointAngle2D(a, b, c);
  return Number.isFinite(angle) ? angle : null;
}

// How far back (ms) to look for the start-position frame before a rep starts.
const READY_LOOKBACK_MS = 3000;

/** Configured angle-cycle detector for a movement with a clear excursion and return. */
export class ActivityStateMachine {
  constructor(config) {
    if (!config?.cycle?.points || !config?.cycle?.signal) {
      throw new Error("ActivityStateMachine requires an exercise cycle definition");
    }
    this.config = config;
    this.cycle = config.cycle;
    this.ascendingSignal = this.cycle.direction === "up";
    this._armed = !this.ascendingSignal;
    this.visibilityThreshold = config.visibilityThreshold ?? 0.5;
    this.minFrames = this.cycle.minFrames ?? 3;
    this.state = "READY";
    this.repCount = 0;
    this._pendingState = null;
    this._pendingFrames = 0;
    this._reps = [];
    this._resetRep();
  }

  // Adds one frame's values to the in-progress rep's extremes and samples.
  _includeSample(values) {
    this._samples.push(values);
    this._minSignal = Math.min(this._minSignal, values.signal);
    this._maxSignal = Math.max(this._maxSignal, values.signal);
    this._minAngle = Math.min(this._minAngle, values.angle);
    this._maxAngle = Math.max(this._maxAngle, values.angle);
    this._maxBodyLineDeviation = Math.max(this._maxBodyLineDeviation, values.metrics.maxBodyLineDeviationDeg ?? 0);
  }

  // The READY frame closest to the start position (deadlift: lowest hip
  // angle = floor setup; push-up: highest elbow angle = top plank). The rep
  // only starts once the signal has left that position, so without this the
  // true setup/top angle would never be recorded.
  _startPositionSample() {
    let best = null;
    for (const sample of this._readySamples) {
      if (!best || (this.ascendingSignal ? sample.signal < best.signal : sample.signal > best.signal)) best = sample;
    }
    return best;
  }

  _resetRep() {
    this._startMs = null;
    this._turnMs = null;
    this._minSignal = Infinity;
    this._maxSignal = -Infinity;
    this._minAngle = Infinity;
    this._maxAngle = -Infinity;
    this._maxBodyLineDeviation = 0;
    this._samples = [];
    this._readySamples = [];
    this._invalidSinceMs = null;
  }

  _getAngles(landmarks) {
    let angle = resolveAngle(landmarks, this.cycle.points, this.visibilityThreshold);
    if (angle == null && this.cycle.alternatePoints) {
      angle = resolveAngle(landmarks, this.cycle.alternatePoints, this.visibilityThreshold);
    }
    if (angle == null) return null;
    const signal = this.cycle.invert ? 180 - angle : angle;
    const metrics = { [this.config.metrics?.angleKey || this.cycle.signal]: angle };
    for (const auxiliary of this.config.metrics?.auxiliaryAngles || []) {
      const aux = resolveAngle(landmarks, auxiliary.points, this.visibilityThreshold)
        ?? (auxiliary.alternatePoints
          ? resolveAngle(landmarks, auxiliary.alternatePoints, this.visibilityThreshold)
          : null);
      if (auxiliary.required && aux == null) return null;
      if (aux != null && auxiliary.key === "bodyLine") {
        metrics.maxBodyLineDeviationDeg = Math.abs(180 - aux);
      }
    }
    return { angle, signal, metrics };
  }

  _transition(next, timestampMs) {
    if (this._pendingState === next) this._pendingFrames += 1;
    else {
      this._pendingState = next;
      this._pendingFrames = 1;
    }
    if (this._pendingFrames < this.minFrames) return false;
    this.state = next;
    this._pendingState = null;
    this._pendingFrames = 0;
    if (next === "LOWERING") {
      this._startMs = timestampMs;
      this._turnMs = null;
      this._minSignal = Infinity;
      this._maxSignal = -Infinity;
      this._minAngle = Infinity;
      this._maxAngle = -Infinity;
      this._maxBodyLineDeviation = 0;
      this._samples = [];
      const startSample = this._startPositionSample();
      if (startSample) this._includeSample(startSample);
      this._readySamples = [];
    }
    if (next === "TURNAROUND") this._turnMs = timestampMs;
    return true;
  }

  update({ landmarks, timestampMs }) {
    if (!Number.isFinite(timestampMs)) return;
    const values = Array.isArray(landmarks) && landmarks.length >= LANDMARK_COUNT
      ? this._getAngles(landmarks)
      : null;
    if (values) values.timestampMs = timestampMs;
    if (!values) {
      this._pendingState = null;
      this._pendingFrames = 0;
      this._invalidSinceMs ??= timestampMs;
      if (timestampMs - this._invalidSinceMs > 1200) {
        if (this.state !== "READY") {
          this.state = "READY";
          this._resetRep();
        }
        this._armed = !this.ascendingSignal;
      }
      return;
    }
    this._invalidSinceMs = null;
    if (this.state !== "READY") {
      this._includeSample(values);
    } else {
      this._readySamples.push(values);
      const cutoff = timestampMs - READY_LOOKBACK_MS;
      while (this._readySamples.length && this._readySamples[0].timestampMs < cutoff) this._readySamples.shift();
    }

    const { startThreshold, excursionThreshold, minAmplitudeDeg = 30 } = this.cycle;
    const startsExcursion = this.ascendingSignal
      ? this._armed && values.signal > startThreshold
      : values.signal < startThreshold;
    const reachesTurnaround = this.ascendingSignal
      ? values.signal >= excursionThreshold
      : values.signal <= excursionThreshold;
    const returnsFromTurnaround = this.ascendingSignal
      ? values.signal < excursionThreshold
      : values.signal > excursionThreshold;
    const returnsToStart = this.ascendingSignal
      ? values.signal <= startThreshold
      : values.signal >= startThreshold;

    if (this.state === "READY") {
      if (this.ascendingSignal && values.signal <= startThreshold) this._armed = true;
      if (startsExcursion) {
        const started = this._transition("LOWERING", timestampMs);
        if (started && this.ascendingSignal) this._armed = false;
      } else {
        this._pendingState = null;
        this._pendingFrames = 0;
      }
    } else if (this.state === "LOWERING") {
      if (reachesTurnaround) this._transition("TURNAROUND", timestampMs);
      else if (returnsToStart) {
        this.state = "READY";
        this._armed = this.ascendingSignal;
        this._pendingState = null;
        this._pendingFrames = 0;
        this._resetRep();
      }
    } else if (this.state === "TURNAROUND") {
      if (returnsFromTurnaround) this._transition("RETURNING", timestampMs);
    } else if (this.state === "RETURNING" && returnsToStart) {
      if (this._maxSignal - this._minSignal >= minAmplitudeDeg && this._startMs != null && this._turnMs != null) {
        this.repCount += 1;
        const angleMetrics = {
          [this.config.metrics?.minKey || "signalMinDeg"]: this._minAngle,
          [this.config.metrics?.maxKey || "signalMaxDeg"]: this._maxAngle,
        };
        if (this.config.metrics?.auxiliaryAngles?.some((item) => item.key === "bodyLine")) {
          angleMetrics.maxBodyLineDeviationDeg = this._maxBodyLineDeviation;
        }
        this._reps.push({
          repNumber: this.repCount,
          startMs: this._startMs,
          bottomMs: this._turnMs,
          endMs: timestampMs,
          minAngleDeg: this._minAngle,
          peakAngleDeg: this._maxAngle,
          romValue: this._maxAngle - this._minAngle,
          angleMetrics,
          series: { [this.cycle.signal]: this._samples.map((sample) => sample.angle) },
        });
      }
      this.state = "READY";
      this._armed = this.ascendingSignal;
      this._pendingState = null;
      this._pendingFrames = 0;
      this._resetRep();
    } else if (this.state === "RETURNING" && reachesTurnaround) {
      this.state = "TURNAROUND";
    }
  }

  getReps() { return this._reps.slice(); }

  reset() {
    this.state = "READY";
    this.repCount = 0;
    this._pendingState = null;
    this._pendingFrames = 0;
    this._reps = [];
    this._armed = !this.ascendingSignal;
    this._resetRep();
  }
}

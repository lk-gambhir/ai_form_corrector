/**
 * Per-landmark EMA (exponential moving average) smoothing to kill MediaPipe
 * jitter before angles/verification/rep-counting consume the landmark stream.
 *
 * Output shape & dropout representation
 * ---------------------------------------
 * `smooth()` returns an array of objects shaped like
 * `{x, y, z, visibility, stale}` (a superset of the Landmark typedef in
 * shared/exercise-config/types.js — the extra `stale` flag is
 * smoother-internal metadata, downstream code that only reads x/y/z/visibility
 * is unaffected).
 *
 * - `stale: false` — this landmark was updated from a live, visible-enough
 *   detection this frame (or is the very first good sample, which passes
 *   through unsmoothed to seed state).
 * - `stale: true` — this landmark's position (x, y, z) was HELD from the
 *   last good smoothed value because either (a) the whole frame was a
 *   dropout (`landmarks.length < LANDMARK_COUNT`), or (b) this particular
 *   landmark's visibility fell below `visibilityThreshold` this frame.
 *   `visibility` on a stale entry always reflects the *current* frame's real
 *   confidence (0 for a whole-frame dropout, since nothing was observed;
 *   the raw low value for a per-landmark visibility dip) — never the old
 *   visibility — so downstream visibility gating (e.g. landmarkVisibleEnough)
 *   still correctly treats it as low-confidence even though a position is
 *   present. This is what "mark it stale" means in practice: hold position
 *   for continuity, but never lie about current confidence.
 *
 * Never emits NaN: if a landmark has never once been seen at
 * visible-enough confidence, there is no "last good value" to hold. In that
 * edge case we pass the current raw (possibly low-confidence) x/y/z through
 * so the field is always a real number, and mark it stale.
 *
 * A total first-frame dropout (empty/short landmarks and no prior state at
 * all) has nothing to hold or pass through, so `smooth()` returns `[]` in
 * that case — matching the "no usable pose" convention used elsewhere
 * (PoseEstimator.detectForVideo, FrameSource frames).
 */

import { LANDMARK_COUNT } from "@shared/exercise-config/landmarks.js";
import { landmarkVisibleEnough } from "@/pose/angles.js";

export class LandmarkSmoother {
  /**
   * @param {{alpha?: number, visibilityThreshold?: number}} [options]
   *   alpha in (0,1]; higher = more responsive to new data / less smoothing.
   */
  constructor({ alpha = 0.5, visibilityThreshold = 0.5 } = {}) {
    if (!(alpha > 0 && alpha <= 1)) {
      throw new Error(`LandmarkSmoother: alpha must be in (0,1], got ${alpha}`);
    }
    this.alpha = alpha;
    this.visibilityThreshold = visibilityThreshold;
    /** @type {Array<{x:number,y:number,z:number,visibility:number}|null>|null} */
    this._state = null;
  }

  /**
   * @param {import("@shared/exercise-config/types.js").Landmark[]} landmarks
   * @returns {Array<{x:number,y:number,z:number,visibility:number,stale:boolean}>}
   */
  smooth(landmarks) {
    const isFrameDropout = !Array.isArray(landmarks) || landmarks.length < LANDMARK_COUNT;

    if (isFrameDropout) {
      if (!this._state) return []; // nothing ever seen — no usable pose
      // Hold every landmark's last good position; signal zero confidence this
      // frame since nothing was actually observed. A landmark that has never
      // once been seen at good confidence (state still null) has no position to
      // hold — emit a zero/zero-confidence placeholder rather than dropping it,
      // so the output stays length LANDMARK_COUNT and indices NEVER shift
      // (a shifted array would feed the wrong joint to downstream angle math).
      return this._state.map((prev) =>
        prev
          ? { x: prev.x, y: prev.y, z: prev.z, visibility: 0, stale: true }
          : { x: 0, y: 0, z: 0, visibility: 0, stale: true }
      );
    }

    if (!this._state) {
      this._state = new Array(LANDMARK_COUNT).fill(null);
    }

    const out = new Array(LANDMARK_COUNT);
    for (let i = 0; i < LANDMARK_COUNT; i++) {
      const current = landmarks[i];
      const prev = this._state[i];
      const visibleEnough = landmarkVisibleEnough(current, this.visibilityThreshold);

      if (visibleEnough) {
        const smoothed = prev
          ? {
              x: this.alpha * current.x + (1 - this.alpha) * prev.x,
              y: this.alpha * current.y + (1 - this.alpha) * prev.y,
              z: this.alpha * current.z + (1 - this.alpha) * prev.z,
              visibility: current.visibility,
            }
          : {
              // First good sample for this landmark: seed state, pass through.
              x: current.x,
              y: current.y,
              z: current.z,
              visibility: current.visibility,
            };
        this._state[i] = smoothed;
        out[i] = { ...smoothed, stale: false };
      } else if (prev) {
        // Hold last good position; report the real (low) current visibility.
        out[i] = { x: prev.x, y: prev.y, z: prev.z, visibility: current?.visibility ?? 0, stale: true };
      } else {
        // Never seen a good sample for this landmark — nothing to hold.
        // Pass the raw (low-confidence) value through rather than emit NaN.
        out[i] = {
          x: current?.x ?? 0,
          y: current?.y ?? 0,
          z: current?.z ?? 0,
          visibility: current?.visibility ?? 0,
          stale: true,
        };
      }
    }

    return out;
  }

  reset() {
    this._state = null;
  }
}

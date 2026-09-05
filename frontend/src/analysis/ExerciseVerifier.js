/**
 * Coarse exercise verification gate — NOT rep counting (that's Week 3).
 * Answers: "does the current stream plausibly show a squat, with the lower
 * body visible and actually moving?" Feed it landmarks frame-by-frame
 * (ideally already smoothed by LandmarkSmoother) and poll getStatus().
 *
 * Heuristic (tuned against the real fixtures in frontend/src/fixtures/,
 * see GROUND_TRUTH.md, using a 30-frame rolling window = ~1s at 30fps /
 * ~2s at ~15fps):
 *   - visibleRatio: fraction of buffered frames where at least one leg's
 *     hip+knee+ankle triplet was all visible-enough (>= visibilityThreshold).
 *     Using "at least one leg" (not both) tolerates a single occluded side.
 *   - angleRange: max-min of the (averaged, when both legs visible) knee
 *     angle across visible frames in the buffer.
 *   - verified = visibleRatio >= visibleRatioThreshold AND
 *                angleRange >= angleRangeThreshold.
 *
 * Observed real numbers (bufferCapacity=30, see ExerciseVerifier.test.js):
 *   - real-squat-good.json: visibleRatio reaches 1.00 almost immediately
 *     (no dropout in this fixture); angleRange climbs to ~130-135deg over
 *     the descent; crosses the verified thresholds (ratio>=0.7, range>=20)
 *     around frame ~43 (~1.4s in, during the first descent).
 *   - real-squat-shallow.json: visibleRatio recovers to 1.00 after the two
 *     early dropout frames; angleRange peaks ~80-88deg; crosses verified
 *     around frame ~205-226 (once a full descent has happened inside the
 *     window — the first ~6s of this clip is a non-squat arm-raise warmup
 *     per GROUND_TRUTH.md, so it correctly does NOT verify during that).
 *   - static standing (synthetic, angle constant): angleRange stays ~0,
 *     never crosses angleRangeThreshold -> verified stays false.
 *   - all-dropout: visibleRatio stays 0 -> verified stays false.
 */

import { POSE_LANDMARKS, LANDMARK_COUNT } from "@shared/exercise-config/landmarks.js";
import { jointAngle2D, landmarkVisibleEnough } from "@/pose/angles.js";
import { RollingBuffer } from "@/analysis/RollingBuffer.js";

const LEG_TRIPLETS = [
  [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],
  [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],
];

export class ExerciseVerifier {
  /**
   * @param {{bufferCapacity?:number, visibilityThreshold?:number, visibleRatioThreshold?:number, angleRangeThreshold?:number}} [options]
   */
  constructor({
    bufferCapacity = 30,
    visibilityThreshold = 0.5,
    visibleRatioThreshold = 0.7,
    angleRangeThreshold = 20,
  } = {}) {
    this.visibilityThreshold = visibilityThreshold;
    this.visibleRatioThreshold = visibleRatioThreshold;
    this.angleRangeThreshold = angleRangeThreshold;
    this._buffer = new RollingBuffer(bufferCapacity);
  }

  /**
   * @param {import("@shared/exercise-config/types.js").Landmark[]} landmarks
   */
  update(landmarks) {
    const record = { visible: false, angle: NaN };

    if (Array.isArray(landmarks) && landmarks.length >= LANDMARK_COUNT) {
      const angles = [];
      for (const [hipIdx, kneeIdx, ankleIdx] of LEG_TRIPLETS) {
        const hip = landmarks[hipIdx];
        const knee = landmarks[kneeIdx];
        const ankle = landmarks[ankleIdx];
        const legVisible =
          landmarkVisibleEnough(hip, this.visibilityThreshold) &&
          landmarkVisibleEnough(knee, this.visibilityThreshold) &&
          landmarkVisibleEnough(ankle, this.visibilityThreshold);
        if (legVisible) {
          record.visible = true;
          const a = jointAngle2D(hip, knee, ankle);
          if (!Number.isNaN(a)) angles.push(a);
        }
      }
      if (angles.length > 0) {
        record.angle = angles.reduce((sum, a) => sum + a, 0) / angles.length;
      }
    }

    this._buffer.push(record);
  }

  /**
   * @returns {{verified:boolean, reason:string, visibleRatio:number, angleRange:number}}
   */
  getStatus() {
    const records = this._buffer.toArray();

    if (records.length === 0) {
      return { verified: false, reason: "no frames observed yet", visibleRatio: 0, angleRange: 0 };
    }

    const visibleCount = records.filter((r) => r.visible).length;
    const visibleRatio = visibleCount / records.length;

    const angles = records.filter((r) => r.visible && !Number.isNaN(r.angle)).map((r) => r.angle);
    const angleRange = angles.length > 0 ? Math.max(...angles) - Math.min(...angles) : 0;

    if (visibleRatio < this.visibleRatioThreshold) {
      return {
        verified: false,
        reason: `lower body not visible enough (visibleRatio=${visibleRatio.toFixed(2)} < ${this.visibleRatioThreshold})`,
        visibleRatio,
        angleRange,
      };
    }

    if (angleRange < this.angleRangeThreshold) {
      return {
        verified: false,
        reason: `no meaningful knee-angle movement detected (angleRange=${angleRange.toFixed(1)} < ${this.angleRangeThreshold})`,
        visibleRatio,
        angleRange,
      };
    }

    return {
      verified: true,
      reason: "lower body visible and knee angle shows squat-like movement",
      visibleRatio,
      angleRange,
    };
  }

  reset() {
    this._buffer.clear();
  }
}

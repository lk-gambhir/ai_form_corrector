// Computes personalized body proportions and baseline range of motion from landmarks.
import { POSE_LANDMARKS } from "@shared/exercise-config/landmarks.js";
import { jointAngle2D } from "@/pose/angles.js";

// Euclidean 2D distance between two landmarks.
export function euclideanDistance(p1, p2) {
  if (!p1 || !p2) return 0;
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export class CalibrationEngine {
  constructor() {
    this.standingFrames = [];
    this.bottomFrames = [];
  }

  // Adds a standing pose frame for limb ratio and standing angle calibration.
  addStandingFrame(landmarks) {
    if (Array.isArray(landmarks) && landmarks.length > POSE_LANDMARKS.RIGHT_ANKLE) {
      this.standingFrames.push(landmarks);
    }
  }

  // Adds a bottom pose frame for inflection angle calibration.
  addBottomFrame(landmarks) {
    if (Array.isArray(landmarks) && landmarks.length > POSE_LANDMARKS.RIGHT_ANKLE) {
      this.bottomFrames.push(landmarks);
    }
  }

  // Computes average limb ratios (femur/torso, shin/torso) across recorded standing frames.
  computeLimbRatios() {
    if (this.standingFrames.length === 0) {
      return { femurToTorso: 1.0, shinToTorso: 0.9 };
    }

    let totalFemurToTorso = 0;
    let totalShinToTorso = 0;
    let validCount = 0;

    for (const lm of this.standingFrames) {
      // Use left or right side based on visibility.
      const leftVis = (lm[POSE_LANDMARKS.LEFT_HIP]?.visibility ?? 1) + (lm[POSE_LANDMARKS.LEFT_KNEE]?.visibility ?? 1);
      const rightVis = (lm[POSE_LANDMARKS.RIGHT_HIP]?.visibility ?? 1) + (lm[POSE_LANDMARKS.RIGHT_KNEE]?.visibility ?? 1);
      const side = leftVis >= rightVis ? "LEFT" : "RIGHT";

      const shoulder = lm[POSE_LANDMARKS[`${side}_SHOULDER`]];
      const hip = lm[POSE_LANDMARKS[`${side}_HIP`]];
      const knee = lm[POSE_LANDMARKS[`${side}_KNEE`]];
      const ankle = lm[POSE_LANDMARKS[`${side}_ANKLE`]];

      const torso = euclideanDistance(shoulder, hip);
      const femur = euclideanDistance(hip, knee);
      const shin = euclideanDistance(knee, ankle);

      if (torso > 0.01) {
        totalFemurToTorso += femur / torso;
        totalShinToTorso += shin / torso;
        validCount += 1;
      }
    }

    if (validCount === 0) return { femurToTorso: 1.0, shinToTorso: 0.9 };
    return {
      femurToTorso: Number((totalFemurToTorso / validCount).toFixed(3)),
      shinToTorso: Number((totalShinToTorso / validCount).toFixed(3)),
    };
  }

  // Computes baseline range of motion angles.
  computeBaselineRom() {
    const calcKneeAngle = (lm) => {
      const side = (lm[POSE_LANDMARKS.LEFT_KNEE]?.visibility ?? 1) >= (lm[POSE_LANDMARKS.RIGHT_KNEE]?.visibility ?? 1) ? "LEFT" : "RIGHT";
      return jointAngle2D(
        lm[POSE_LANDMARKS[`${side}_HIP`]],
        lm[POSE_LANDMARKS[`${side}_KNEE`]],
        lm[POSE_LANDMARKS[`${side}_ANKLE`]]
      );
    };

    const calcHipAngle = (lm) => {
      const side = (lm[POSE_LANDMARKS.LEFT_HIP]?.visibility ?? 1) >= (lm[POSE_LANDMARKS.RIGHT_HIP]?.visibility ?? 1) ? "LEFT" : "RIGHT";
      return jointAngle2D(
        lm[POSE_LANDMARKS[`${side}_SHOULDER`]],
        lm[POSE_LANDMARKS[`${side}_HIP`]],
        lm[POSE_LANDMARKS[`${side}_KNEE`]]
      );
    };

    const standingKnees = this.standingFrames.map(calcKneeAngle).filter((a) => !Number.isNaN(a));
    const bottomKnees = this.bottomFrames.map(calcKneeAngle).filter((a) => !Number.isNaN(a));
    const standingHips = this.standingFrames.map(calcHipAngle).filter((a) => !Number.isNaN(a));
    const bottomHips = this.bottomFrames.map(calcHipAngle).filter((a) => !Number.isNaN(a));

    const avg = (arr, fallback) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : fallback);

    return {
      kneeStanding: Number(avg(standingKnees, 170).toFixed(1)),
      kneeBottom: Number(avg(bottomKnees, 85).toFixed(1)),
      hipStanding: Number(avg(standingHips, 168).toFixed(1)),
      hipBottom: Number(avg(bottomHips, 90).toFixed(1)),
    };
  }

  // Finalizes and returns complete UserBaseline object.
  generateBaseline() {
    const limbRatios = this.computeLimbRatios();
    const rom = this.computeBaselineRom();
    return {
      limbRatios,
      rom,
      angleStats: {
        knee: { mean: (rom.kneeStanding + rom.kneeBottom) / 2, std: (rom.kneeStanding - rom.kneeBottom) / 4 },
        hip: { mean: (rom.hipStanding + rom.hipBottom) / 2, std: (rom.hipStanding - rom.hipBottom) / 4 },
      },
      calibratedAt: new Date().toISOString(),
    };
  }

  // Resets collected calibration frames.
  reset() {
    this.standingFrames = [];
    this.bottomFrames = [];
  }
}

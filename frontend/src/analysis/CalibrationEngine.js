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

// Minimum visibility threshold for a landmark to be considered reliable.
const MIN_VISIBILITY = 0.5;

export class CalibrationEngine {
  constructor(exercise = "squat") {
    this.exercise = exercise;
    this.standingFrames = [];
    this.bottomFrames = [];
  }

  setExercise(exercise) {
    this.exercise = exercise;
    this.reset();
  }

  // Adds a standing pose frame for limb ratio and standing angle calibration.
  addStandingFrame(landmarks) {
    if (Array.isArray(landmarks) && landmarks.length > POSE_LANDMARKS.RIGHT_ANKLE) {
      this.standingFrames.push(landmarks);
    }
  }

  // Adds a bottom pose frame for inflection angle and torso lean calibration.
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
      const leftVis = (lm[POSE_LANDMARKS.LEFT_HIP]?.visibility ?? 0) + (lm[POSE_LANDMARKS.LEFT_KNEE]?.visibility ?? 0);
      const rightVis = (lm[POSE_LANDMARKS.RIGHT_HIP]?.visibility ?? 0) + (lm[POSE_LANDMARKS.RIGHT_KNEE]?.visibility ?? 0);
      const side = leftVis >= rightVis ? "LEFT" : "RIGHT";

      const shoulder = lm[POSE_LANDMARKS[`${side}_SHOULDER`]];
      const hip = lm[POSE_LANDMARKS[`${side}_HIP`]];
      const knee = lm[POSE_LANDMARKS[`${side}_KNEE`]];
      const ankle = lm[POSE_LANDMARKS[`${side}_ANKLE`]];

      const torso = euclideanDistance(shoulder, hip);
      const femur = euclideanDistance(hip, knee);
      const shin = euclideanDistance(knee, ankle);

      const points = [shoulder, hip, knee, ankle];
      const visible = points.every((point) => point && (point.visibility ?? 0) >= MIN_VISIBILITY);
      if (visible && torso > 0.01) {
        totalFemurToTorso += femur / torso;
        totalShinToTorso += shin / torso;
        validCount += 1;
      }
    }

    if (validCount === 0) return { femurToTorso: Number.NaN, shinToTorso: Number.NaN };
    return {
      femurToTorso: Number((totalFemurToTorso / validCount).toFixed(3)),
      shinToTorso: Number((totalShinToTorso / validCount).toFixed(3)),
    };
  }

  // Computes baseline range of motion angles.
  computeBaselineRom() {
    const avg = (arr, fallback = Number.NaN) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : fallback);

    if (this.exercise === "push_up") {
      const calcElbowAngle = (lm) => {
        const side = (lm[POSE_LANDMARKS.LEFT_ELBOW]?.visibility ?? 0) >= (lm[POSE_LANDMARKS.RIGHT_ELBOW]?.visibility ?? 0) ? "LEFT" : "RIGHT";
        return jointAngle2D(
          lm[POSE_LANDMARKS[`${side}_SHOULDER`]],
          lm[POSE_LANDMARKS[`${side}_ELBOW`]],
          lm[POSE_LANDMARKS[`${side}_WRIST`]]
        );
      };
      const calcBodyLine = (lm) => {
        const side = (lm[POSE_LANDMARKS.LEFT_HIP]?.visibility ?? 0) >= (lm[POSE_LANDMARKS.RIGHT_HIP]?.visibility ?? 0) ? "LEFT" : "RIGHT";
        return jointAngle2D(
          lm[POSE_LANDMARKS[`${side}_SHOULDER`]],
          lm[POSE_LANDMARKS[`${side}_HIP`]],
          lm[POSE_LANDMARKS[`${side}_ANKLE`]]
        );
      };
      const topElbows = this.standingFrames.map(calcElbowAngle).filter((a) => !Number.isNaN(a));
      const bottomElbows = this.bottomFrames.map(calcElbowAngle).filter((a) => !Number.isNaN(a));
      const bodyLines = this.standingFrames.map(calcBodyLine).filter((a) => !Number.isNaN(a));

      return {
        exercise: "push_up",
        elbowTop: Number(avg(topElbows).toFixed(1)),
        elbowBottom: Number(avg(bottomElbows).toFixed(1)),
        bodyLineDeg: Number(avg(bodyLines).toFixed(1)),
      };
    }

    if (this.exercise === "deadlift") {
      const calcHipAngle = (lm) => {
        const side = (lm[POSE_LANDMARKS.LEFT_HIP]?.visibility ?? 0) >= (lm[POSE_LANDMARKS.RIGHT_HIP]?.visibility ?? 0) ? "LEFT" : "RIGHT";
        return jointAngle2D(
          lm[POSE_LANDMARKS[`${side}_SHOULDER`]],
          lm[POSE_LANDMARKS[`${side}_HIP`]],
          lm[POSE_LANDMARKS[`${side}_KNEE`]]
        );
      };
      const lockoutHips = this.standingFrames.map(calcHipAngle).filter((a) => !Number.isNaN(a));
      const setupHips = this.bottomFrames.map(calcHipAngle).filter((a) => !Number.isNaN(a));

      return {
        exercise: "deadlift",
        hipLockout: Number(avg(lockoutHips).toFixed(1)),
        hipSetup: Number(avg(setupHips).toFixed(1)),
      };
    }

    const calcKneeAngle = (lm) => {
      const side = (lm[POSE_LANDMARKS.LEFT_KNEE]?.visibility ?? 0) >= (lm[POSE_LANDMARKS.RIGHT_KNEE]?.visibility ?? 0) ? "LEFT" : "RIGHT";
      return jointAngle2D(
        lm[POSE_LANDMARKS[`${side}_HIP`]],
        lm[POSE_LANDMARKS[`${side}_KNEE`]],
        lm[POSE_LANDMARKS[`${side}_ANKLE`]]
      );
    };

    const calcHipAngle = (lm) => {
      const side = (lm[POSE_LANDMARKS.LEFT_HIP]?.visibility ?? 0) >= (lm[POSE_LANDMARKS.RIGHT_HIP]?.visibility ?? 0) ? "LEFT" : "RIGHT";
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

    return {
      exercise: "squat",
      kneeStanding: Number(avg(standingKnees).toFixed(1)),
      kneeBottom: Number(avg(bottomKnees).toFixed(1)),
      hipStanding: Number(avg(standingHips).toFixed(1)),
      hipBottom: Number(avg(bottomHips).toFixed(1)),
    };
  }

  /**
   * Computes typical torso lean from bottom-position frames.
   * Torso lean = angle between the shoulder→hip vector and vertical.
   * Rejects frames where shoulder or hip visibility is below MIN_VISIBILITY.
   * Returns median of valid measurements, or null if insufficient data.
   */
  computeTorsoLean() {
    const leanValues = [];

    for (const lm of this.bottomFrames) {
      // Pick the more visible side
      const leftVis = (lm[POSE_LANDMARKS.LEFT_SHOULDER]?.visibility ?? 0) + (lm[POSE_LANDMARKS.LEFT_HIP]?.visibility ?? 0);
      const rightVis = (lm[POSE_LANDMARKS.RIGHT_SHOULDER]?.visibility ?? 0) + (lm[POSE_LANDMARKS.RIGHT_HIP]?.visibility ?? 0);
      const side = leftVis >= rightVis ? "LEFT" : "RIGHT";

      const shoulder = lm[POSE_LANDMARKS[`${side}_SHOULDER`]];
      const hip = lm[POSE_LANDMARKS[`${side}_HIP`]];

      // Reject low-visibility frames
      if (!shoulder || !hip) continue;
      if ((shoulder.visibility ?? 0) < MIN_VISIBILITY || (hip.visibility ?? 0) < MIN_VISIBILITY) continue;

      // Vector from hip to shoulder
      const dx = shoulder.x - hip.x;
      const dy = shoulder.y - hip.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length < 0.01) continue;

      // Angle from vertical (vertical = straight up = dy negative in screen coords).
      // cos(theta) = |dy| / length — using abs(dy) since vertical is the y-axis.
      const cosAngle = Math.abs(dy) / length;
      const angleDeg = Math.acos(Math.min(1, cosAngle)) * (180 / Math.PI);
      leanValues.push(angleDeg);
    }

    if (leanValues.length === 0) return null;

    // Return median for robustness against outlier frames.
    leanValues.sort((a, b) => a - b);
    const mid = Math.floor(leanValues.length / 2);
    const median = leanValues.length % 2 === 0
      ? (leanValues[mid - 1] + leanValues[mid]) / 2
      : leanValues[mid];

    return Number(median.toFixed(1));
  }

  // Finalizes and returns complete UserBaseline object.
  generateBaseline() {
    if (!this.standingFrames.length || !this.bottomFrames.length) {
      throw new Error("Capture both calibration positions before saving a profile.");
    }
    const rom = this.computeBaselineRom();
    if (Object.values(rom).some((value) => typeof value === "number" && !Number.isFinite(value))) {
      throw new Error("Calibration measurements are incomplete. Improve visibility and capture both positions again.");
    }
    const isSquat = this.exercise === "squat";
    const limbRatios = isSquat ? this.computeLimbRatios() : {};
    if (Object.values(limbRatios).some((value) => !Number.isFinite(value))) {
      throw new Error("Calibration measurements are incomplete. Improve visibility and capture both positions again.");
    }
    const typicalTorsoLean = isSquat ? this.computeTorsoLean() : null;

    if (typicalTorsoLean != null) {
      rom.typicalTorsoLean = typicalTorsoLean;
    }

    let angleStats = {};
    if (this.exercise === "push_up") {
      angleStats = {
        elbow: { mean: (rom.elbowTop + rom.elbowBottom) / 2, std: (rom.elbowTop - rom.elbowBottom) / 4 },
        body_line: { mean: rom.bodyLineDeg, std: 2.0 },
      };
    } else if (this.exercise === "deadlift") {
      angleStats = {
        hip: { mean: (rom.hipLockout + rom.hipSetup) / 2, std: (rom.hipLockout - rom.hipSetup) / 4 },
      };
    } else {
      angleStats = {
        knee: { mean: (rom.kneeStanding + rom.kneeBottom) / 2, std: (rom.kneeStanding - rom.kneeBottom) / 4 },
        hip: { mean: (rom.hipStanding + rom.hipBottom) / 2, std: (rom.hipStanding - rom.hipBottom) / 4 },
        ...(typicalTorsoLean != null ? { typical_torso_lean: typicalTorsoLean } : {}),
      };
    }

    return {
      exercise: this.exercise,
      limbRatios,
      rom,
      angleStats,
      calibratedAt: new Date().toISOString(),
    };
  }

  // Resets collected calibration frames.
  reset() {
    this.standingFrames = [];
    this.bottomFrames = [];
  }
}

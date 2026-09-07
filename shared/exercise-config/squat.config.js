// Squat exercise configuration.

const drivingAngles = [
  { id: "knee_left", points: ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"], plane: "2d" },
  { id: "knee_right", points: ["RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE"], plane: "2d" },
];

const compositeAngles = [
  { id: "knee", from: ["knee_left", "knee_right"] },
];

const states = [
  { name: "STANDING", enterWhen: { signal: "knee", op: ">", value: 155, hysteresis: 7.5, minFrames: 3 } },
  { name: "DESCENDING", enterWhen: { signal: "knee", op: "<", value: 155, hysteresis: 7.5, minFrames: 3 } },
  { name: "BOTTOM", enterWhen: { signal: "knee", op: "<", value: 140, hysteresis: 7.5, minFrames: 3 } },
  { name: "ASCENDING", enterWhen: { signal: "knee", op: ">", value: 140, hysteresis: 7.5, minFrames: 3 } },
];

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
    downThresholdDeg: 140,
    upThresholdDeg: 155,
    minFrames: 3,
  },
  rules: [],
  tempoBounds: { minSec: 0.5, maxSec: 12 },
  scoreWeights: {},
  visibilityThreshold: 0.5,
};

export default squatConfig;

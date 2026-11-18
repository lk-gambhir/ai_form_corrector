// Conventional deadlift analysis definition. Single-camera measures are
// heuristic proxies and do not estimate bar path or spinal loading.
export const deadliftConfig = {
  id: "deadlift",
  label: "Deadlift",
  displayName: "Deadlift",
  description: "Track conventional deadlift repetitions and hip lockout.",
  setupGuidance: "Use a side view with your full body and floor visible. Bar path is not tracked.",
  primaryMetricLabel: "Hip extension",
  enabled: true,
  visibilityThreshold: 0.55,
  cycle: {
    signal: "hip_hinge",
    points: ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_KNEE"],
    alternatePoints: ["RIGHT_SHOULDER", "RIGHT_HIP", "RIGHT_KNEE"],
    // Hip angle rises from floor setup into lockout, then returns to setup.
    direction: "up",
    startThreshold: 110,
    excursionThreshold: 145,
    minAmplitudeDeg: 30,
    minFrames: 3,
  },
  metrics: {
    angleKey: "hipAngle",
    minKey: "hipSetupDeg",
    maxKey: "hipLockoutDeg",
    auxiliaryAngles: [],
  },
  rules: {
    lockout: {
      metric: "hipLockoutDeg", op: ">=", threshold: 165, priority: 1, severity: "medium",
      cue: "Finish the repetition by standing tall under control.",
    },
    movement_range: {
      metric: "romValue", op: ">=", threshold: 35, priority: 2, severity: "medium",
      cue: "Use a clear setup-to-standing range for each repetition.",
    },
  },
  scoreWeights: { lockout: 0.55, movement_range: 0.45 },
};

export default deadliftConfig;

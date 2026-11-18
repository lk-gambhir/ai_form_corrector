// Push-up analysis definition. All thresholds are heuristic and are surfaced
// as exercise-specific feedback, not medical assessments.
export const pushupConfig = {
  id: "push_up",
  label: "Push-up",
  displayName: "Push-up",
  description: "Track push-up repetitions, elbow range, and body alignment.",
  setupGuidance: "Use a side view. Keep shoulders, elbows, hips, and ankles visible in frame.",
  primaryMetricLabel: "Elbow flexion",
  enabled: true,
  visibilityThreshold: 0.55,
  cycle: {
    signal: "elbow",
    points: ["LEFT_SHOULDER", "LEFT_ELBOW", "LEFT_WRIST"],
    alternatePoints: ["RIGHT_SHOULDER", "RIGHT_ELBOW", "RIGHT_WRIST"],
    invert: false,
    startThreshold: 145,
    excursionThreshold: 115,
    minAmplitudeDeg: 30,
    minFrames: 3,
  },
  metrics: {
    angleKey: "elbowFlexion",
    minKey: "elbowBottomDeg",
    maxKey: "elbowTopDeg",
    auxiliaryAngles: [
      { key: "bodyLine", points: ["LEFT_SHOULDER", "LEFT_HIP", "LEFT_ANKLE"], alternatePoints: ["RIGHT_SHOULDER", "RIGHT_HIP", "RIGHT_ANKLE"], required: true },
    ],
  },
  rules: {
    range_of_motion: {
      metric: "elbowBottomDeg", op: "<=", threshold: 90, priority: 2, severity: "medium",
      cue: "Lower until your elbows reach approximately 90 degrees.",
    },
    body_alignment: {
      metric: "maxBodyLineDeviationDeg", op: "<=", threshold: 25, priority: 1, severity: "medium",
      cue: "Keep your shoulders, hips, and ankles moving as one line.",
    },
  },
  scoreWeights: { range_of_motion: 0.6, body_alignment: 0.4 },
};

export default pushupConfig;

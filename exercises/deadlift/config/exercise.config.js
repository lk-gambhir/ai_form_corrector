// Conventional deadlift analysis definition. Single-camera measures are
// heuristic proxies and do not estimate bar path or spinal loading.
//
// Angle convention: "hip angle" here is the 2D angle at the hip between the
// hip->shoulder (trunk) and hip->knee (thigh) segments, so 180 deg = trunk and
// thigh in one straight line (standing tall). Published studies measure hip
// angles with 3D marker models, so their absolute values are not directly
// comparable with this 2D landmark angle; they are cited for definitions and
// magnitudes, not as exact thresholds.
//
// Every threshold below is tagged [cited] (stated by a source) or
// [heuristic] (chosen by this project; needs validation on real footage).
//
// References (verified against PubMed records via NCBI E-utilities):
// [1] Hanen NC, Ben Mansour K, Ertel GN, Duchene Y, Gauchard GC.
//     Biomechanical analysis of conventional and sumo deadlift.
//     Front Bioeng Biotechnol. 2025;13:1597209.
//     doi:10.3389/fbioe.2025.1597209. PMID 40497251. PMCID PMC12148905.
//     - Lift completion is "an upright stance with fully extended knees and
//       hips and retracted shoulders" (Section 2.4).
//     - Conventional deadlift hip range of motion (Table 1, mean +/- SD,
//       n = 30 men): 38.3 +/- 6.1 deg lift-off -> knee passing, and
//       49.4 +/- 9.7 deg knee passing -> completion, i.e. about 88 deg in total.
// [2] Escamilla RF, Francisco AC, Fleisig GS, et al. A three-dimensional
//     biomechanical analysis of sumo and conventional style deadlifts.
//     Med Sci Sports Exerc. 2000;32(7):1265-1275.
//     doi:10.1097/00005768-200007000-00013. PMID 10912892.
//     - Measures the lift at barbell lift-off, knee passing and lift
//       completion; at lift-off and knee passing the conventional group's
//       hips and knees were ~12 deg more extended than the sumo group's.
//       Also reports that 2D calculations differed significantly from 3D.
export const deadliftReferences = [
  {
    id: "hanen2025",
    citation: "Hanen NC, et al. Biomechanical analysis of conventional and sumo deadlift. Front Bioeng Biotechnol. 2025;13:1597209.",
    doi: "10.3389/fbioe.2025.1597209",
    url: "https://doi.org/10.3389/fbioe.2025.1597209",
  },
  {
    id: "escamilla2000",
    citation: "Escamilla RF, et al. A three-dimensional biomechanical analysis of sumo and conventional style deadlifts. Med Sci Sports Exerc. 2000;32(7):1265-1275.",
    doi: "10.1097/00005768-200007000-00013",
    url: "https://doi.org/10.1097/00005768-200007000-00013",
  },
];

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
    // The three phase points follow [1] and [2]: lift-off -> completion.
    direction: "up",
    // [heuristic] Rep-detection thresholds only (when to start/turn around),
    // not form criteria: a rep starts after the hip opens past 110 deg and
    // must reach 145 deg before it can count.
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
    // [cited] The target - full hip extension at lift completion - is the
    // completion criterion in [1] (180 deg in this 2D convention).
    // [heuristic] The 15 deg tolerance below 180 allows for 2D landmark noise
    // and is not from a source. Calibration can lower it to 150 deg minimum.
    lockout: {
      metric: "hipLockoutDeg", op: ">=", threshold: 165, priority: 1, severity: "medium",
      cue: "Finish the repetition by standing tall under control.",
      evidence: { basis: "cited+heuristic", references: ["hanen2025"] },
    },
    // A counted rep always spans at least startThreshold..excursionThreshold
    // (110 -> 145 = 35 deg), so a ROM >= 35 rule could never fail; this rule
    // checks how deep the setup hinge was instead.
    // [cited] Magnitude: [1] reports ~88 deg of hip extension from lift-off to
    // completion for the conventional deadlift.
    // [heuristic] 100 deg: with a ~170 deg lockout this requires roughly 70+
    // deg of hip extension per rep, a conservative fraction of the ~88 deg in
    // [1]. Not a published cut-off; validate on real footage.
    movement_range: {
      metric: "hipSetupDeg", op: "<=", threshold: 100, priority: 2, severity: "medium",
      cue: "Hinge all the way down to your floor setup before each pull.",
      evidence: { basis: "cited+heuristic", references: ["hanen2025", "escamilla2000"] },
    },
  },
  scoreWeights: { lockout: 0.55, movement_range: 0.45 },
  references: deadliftReferences,
};

export default deadliftConfig;

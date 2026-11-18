// Push-up analysis definition. All thresholds are surfaced as
// exercise-specific feedback, not medical assessments.
//
// Angle conventions (2D, from MediaPipe landmarks):
// - Elbow angle: angle at the elbow between elbow->shoulder and elbow->wrist.
//   180 deg = arm straight; 90 deg = "90 deg of elbow flexion" as used in [1].
// - Body line: angle at the hip between hip->shoulder and hip->ankle.
//   180 deg = shoulders, hips and ankles in one straight line;
//   maxBodyLineDeviationDeg = |180 - body line| (sagging or piking).
//
// Every threshold below is tagged [cited] (stated by a source) or
// [heuristic] (chosen by this project; needs validation on real footage).
//
// References (verified against PubMed records via NCBI E-utilities):
// [1] Kowalski KL, Connelly DM, Jakobi JM, Sadi J. Shoulder electromyography
//     activity during push-up variations: a scoping review.
//     Shoulder Elbow. 2022;14(3):326-340. doi:10.1177/17585732211019373.
//     PMID 35599715. PMCID PMC9121296.
//     - Standard push-up (Introduction): starting position with "hips in a
//       neutral position, and knees extended"; "The body is then lowered to
//       the ground until the elbows reach 90 deg of flexion, followed by a
//       return back to the starting position."
// [2] San Juan JG, Suprak DN, Roach SM, Lyda M. The effects of exercise type
//     and elbow angle on vertical ground reaction force and muscle activity
//     during a push-up plus exercise. BMC Musculoskelet Disord. 2015;16:23.
//     doi:10.1186/s12891-015-0486-5. PMID 25881172. PMCID PMC4327800.
//     - Methods: subjects maintained "an angle of approximately 180 deg
//       between the upper and lower body" (push-up plus protocol).
export const pushupReferences = [
  {
    id: "kowalski2022",
    citation: "Kowalski KL, et al. Shoulder electromyography activity during push-up variations: a scoping review. Shoulder Elbow. 2022;14(3):326-340.",
    doi: "10.1177/17585732211019373",
    url: "https://doi.org/10.1177/17585732211019373",
  },
  {
    id: "sanjuan2015",
    citation: "San Juan JG, et al. The effects of exercise type and elbow angle on vertical ground reaction force and muscle activity during a push-up plus exercise. BMC Musculoskelet Disord. 2015;16:23.",
    doi: "10.1186/s12891-015-0486-5",
    url: "https://doi.org/10.1186/s12891-015-0486-5",
  },
];

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
    // [heuristic] Rep-detection thresholds only, not form criteria: a rep
    // starts when the elbow bends below 145 deg and must pass 115 deg before
    // it can count, so a shallow rep (bottom between 90 and 115 deg) is still
    // counted but fails range_of_motion below.
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
    // [cited] Bottom of a standard push-up = elbows at 90 deg of flexion [1].
    range_of_motion: {
      metric: "elbowBottomDeg", op: "<=", threshold: 90, priority: 2, severity: "medium",
      cue: "Lower until your elbows reach approximately 90 degrees.",
      evidence: { basis: "cited", references: ["kowalski2022"] },
    },
    // [cited] Target: a straight (~180 deg) shoulder-hip-ankle line - hips
    // neutral and knees extended [1], ~180 deg between upper and lower body [2].
    // [heuristic] The 25 deg allowed deviation is not from a source; it
    // allows for 2D landmark noise. Calibration can narrow it to 20 deg.
    body_alignment: {
      metric: "maxBodyLineDeviationDeg", op: "<=", threshold: 25, priority: 1, severity: "medium",
      cue: "Keep your shoulders, hips, and ankles moving as one line.",
      evidence: { basis: "cited+heuristic", references: ["kowalski2022", "sanjuan2015"] },
    },
  },
  scoreWeights: { range_of_motion: 0.6, body_alignment: 0.4 },
  references: pushupReferences,
};

export default pushupConfig;

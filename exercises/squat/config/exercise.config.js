// Squat exercise configuration.
//
// Every threshold is tagged [cited] (stated by a source) or [heuristic]
// (chosen by this project; needs validation on real footage).
//
// Depth and torso-lean references (verified against PubMed records):
// [5] Schoenfeld BJ. Squatting kinematics and kinetics and their application
//     to exercise performance. J Strength Cond Res. 2010;24(12):3497-3506.
//     doi:10.1519/JSC.0b013e3181bac2d7. PMID 20182386.
//     - Depth is "generally measured by the degree of flexion at the knee":
//       partial squats ~40 deg, half squats 70-100 deg, deep squats > 100 deg
//       of knee flexion; "no standardized measures ... have been universally
//       recognized".
// [6] Lee TS, Song MY, Kwon YJ. Activation of back and lower limb muscles
//     during squat exercises with different trunk flexion. J Phys Ther Sci.
//     2016;28(12):3407-3410. doi:10.1589/jpts.28.3407. PMID 28174462.
//     - Compared squats at 0, 15 and 30 deg of trunk flexion; recommends an
//       erect trunk "while reducing the load on the lower back".
// [7] Fry AC, Smith JC, Schilling BK. Effect of knee position on hip and knee
//     torques during the barbell squat. J Strength Cond Res.
//     2003;17(4):629-633. PMID 14636100.
//     - More anterior trunk lean shifted torque from the knees to the hips
//       and low back.
//
// Knee valgus references (verified against PubMed records via NCBI E-utilities):
// [1] Mizner RL, Chmielewski TL, Toepke JJ, Tofte KB. Comparison of
//     2-dimensional measurement techniques for predicting knee angle and
//     moment during a drop vertical jump. Clin J Sport Med. 2012;22(3):221-227.
//     doi:10.1097/JSM.0b013e31823a46ce. PMID 22544058. PMCID PMC3340567.
//     - Knee-to-ankle separation ratio = distance between knee joints divided
//       by distance between ankles, from a frontal-plane camera, at peak knee
//       flexion. "A value of 1.0 represents alignment of the knees directly
//       over the ankles"; below 1.0 the knees are medial to the ankles.
//     - It explained more variance in 3D knee abduction angle and moment than
//       the frontal plane projection angle; 2D rater reliability ICC 0.89-0.94.
//     - No cut-off value is proposed ("does not ... provide threshold values").
// [2] Ortiz A, Rosario-Canales M, Rodriguez A, et al. Reliability and
//     concurrent validity between two-dimensional and three-dimensional
//     evaluations of knee valgus during drop jumps. Open Access J Sports Med.
//     2016;7:65-73. doi:10.2147/OAJSM.S100242. PMID 27313480.
//     - "A ratio <1.0 represented knees medial to ankles (valgus)"; 2D vs 3D
//       knee-to-ankle ratio agreement ICC 0.96.
// [3] Noyes FR, Barber-Westin SD, Fleckenstein C, Walsh C, West J. The
//     drop-jump screening test: difference in lower limb control by gender
//     and effect of neuromuscular training in female athletes.
//     Am J Sports Med. 2005;33(2):197-207. doi:10.1177/0363546504266484.
//     PMID 15701605.
//     - Origin of the video knee-separation screen (knee/ankle separation
//       normalized to hip separation).
// [4] Google AI Edge. MediaPipe Pose Landmarker guide for Web: z is landmark
//     depth with the midpoint of the hips as origin, on roughly the same
//     scale as x. https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js
//     (used for the front-view check, not a biomechanics source).
//
// Note: the studies used a drop vertical jump, not a bodyweight squat, so they
// support the measure and its 1.0 reference, not a squat-specific cut-off.
export const squatReferences = [
  { id: "schoenfeld2010", citation: "Schoenfeld BJ. Squatting kinematics and kinetics and their application to exercise performance. J Strength Cond Res. 2010;24(12):3497-3506.", doi: "10.1519/JSC.0b013e3181bac2d7", url: "https://doi.org/10.1519/JSC.0b013e3181bac2d7" },
  { id: "lee2016", citation: "Lee TS, Song MY, Kwon YJ. Activation of back and lower limb muscles during squat exercises with different trunk flexion. J Phys Ther Sci. 2016;28(12):3407-3410.", doi: "10.1589/jpts.28.3407", url: "https://doi.org/10.1589/jpts.28.3407" },
  { id: "fry2003", citation: "Fry AC, Smith JC, Schilling BK. Effect of knee position on hip and knee torques during the barbell squat. J Strength Cond Res. 2003;17(4):629-633.", url: "https://pubmed.ncbi.nlm.nih.gov/14636100/" },
  { id: "mizner2012", citation: "Mizner RL, et al. Comparison of 2-dimensional measurement techniques for predicting knee angle and moment during a drop vertical jump. Clin J Sport Med. 2012;22(3):221-227.", doi: "10.1097/JSM.0b013e31823a46ce", url: "https://doi.org/10.1097/JSM.0b013e31823a46ce" },
  { id: "ortiz2016", citation: "Ortiz A, et al. Reliability and concurrent validity between two-dimensional and three-dimensional evaluations of knee valgus during drop jumps. Open Access J Sports Med. 2016;7:65-73.", doi: "10.2147/OAJSM.S100242", url: "https://doi.org/10.2147/OAJSM.S100242" },
  { id: "noyes2005", citation: "Noyes FR, et al. The drop-jump screening test: difference in lower limb control by gender and effect of neuromuscular training in female athletes. Am J Sports Med. 2005;33(2):197-207.", doi: "10.1177/0363546504266484", url: "https://doi.org/10.1177/0363546504266484" },
  { id: "mediapipe-pose", citation: "Google AI Edge. Pose landmark detection guide for Web (MediaPipe Pose Landmarker).", url: "https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js" },
];

// Driving joint angles for squat analysis.
const drivingAngles = [
  { id: "knee_left", points: ["LEFT_HIP", "LEFT_KNEE", "LEFT_ANKLE"], plane: "2d" },
  { id: "knee_right", points: ["RIGHT_HIP", "RIGHT_KNEE", "RIGHT_ANKLE"], plane: "2d" },
];

// Composite bilateral angle averaging both knees or falling back to the visible leg.
const compositeAngles = [
  { id: "knee", from: ["knee_left", "knee_right"] },
];

// State definitions for rep cycle.
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
  description: "Track squat repetitions, depth, and torso position.",
  setupGuidance: "Use a side or slight three-quarter view with your hips, knees, and ankles in frame. Knee tracking (valgus) is only checked when you face the camera.",
  primaryMetricLabel: "Knee flexion",
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
  rules: {
    // Lowest 2D knee angle must be <= 90 deg (180 = straight leg), i.e. at
    // least 90 deg of knee flexion.
    // [cited] Depth is measured by knee flexion; 70-100 deg flexion = half
    //   squat, > 100 deg = deep squat [5].
    // [heuristic] 90 deg itself (inside the half-squat band); calibration can
    //   move it to the user's calibrated bottom + 5 deg, never below 70 deg.
    depth: {
      enabled: true, minAngleDeg: 90, tolerance: 5, safetyFloor: 70, cue: "Squat deeper - hips below knees",
      evidence: { basis: "cited+heuristic", references: ["schoenfeld2010"] },
    },
    // Max torso lean from vertical during the rep (side views only).
    // [cited] Rationale: a more upright trunk reduces lower-back load [6];
    //   more forward lean shifts torque to the hips and low back [7].
    // [heuristic] 30 deg cap = the top of the 0-30 deg range studied in [6]
    //   (+3 deg tolerance when calibrated, never above 35 deg). No source gives
    //   a maximum. It was 20 deg, but once angles were corrected for the
    //   camera's aspect ratio the project's own "good" squat clip leaned
    //   ~29 deg and failed. Validate on more footage.
    torso_lean: {
      enabled: true, maxAngleDeg: 30, tolerance: 3, safetyCeiling: 35, cue: "Keep torso more upright",
      evidence: { basis: "cited+heuristic", references: ["lee2016", "fry2003"] },
    },
    // Evaluated against tempoBounds (whole-rep duration in seconds).
    // [heuristic] 0.5-12 s: catches bouncing and stalling; no source.
    tempo: { enabled: true, cue: "Control your tempo - no bouncing or stalling", evidence: { basis: "heuristic", references: [] } },
    // Knee-to-ankle separation ratio at the deepest front-view frame.
    // [cited] Measure, peak-knee-flexion instant and the 1.0 reference [1][2].
    // [heuristic] minKneeAnkleRatio 0.9: no published cut-off exists [1]; the
    //   10% margin below 1.0 allows for landmark noise.
    // [heuristic] maxBodyYawDeg 25: the ratio needs a frontal camera [1]; a
    //   rep is only measured when shoulders and hips are within 25 deg of
    //   square to the camera (estimated from MediaPipe depth [4]). Reps filmed
    //   from the side are reported as not measured and left out of this
    //   rule's share of the score (see scoreMeasuredBy).
    knee_valgus: {
      enabled: true, minKneeAnkleRatio: 0.9, maxBodyYawDeg: 25,
      cue: "Push your knees out in line with your toes",
      evidence: { basis: "cited+heuristic", references: ["mizner2012", "ortiz2016", "noyes2005", "mediapipe-pose"] },
    },
  },
  tempoBounds: { minSec: 0.5, maxSec: 12 },
  scoreWeights: {
    depth: 0.35,
    knee_valgus: 0.25,
    torso_lean: 0.25,
    tempo: 0.15,
  },
  // A rule listed here only counts for reps whose angleMetrics contain the
  // named metric (or that logged an issue for it). If no rep in a session has
  // it, the rule is dropped and the other weights are rescaled to sum to 1.
  // Mirrored in exercises/squat/backend/scoring.py (SCORE_MEASURED_BY).
  // Torso lean is only measured from non-front views (forward lean is not
  // visible from the front), knee valgus only from front views.
  scoreMeasuredBy: { knee_valgus: "kneeAnkleRatio", torso_lean: "torsoLeanMaxDeg" },
  visibilityThreshold: 0.5,
  references: squatReferences,
};

export default squatConfig;

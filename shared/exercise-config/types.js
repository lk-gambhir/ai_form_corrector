/**
 * Shared type definitions (JSDoc `@typedef`) — this is plain JS, but these
 * typedefs give editors/tools structure and document the contracts every
 * pipeline module and the backend payload agree on.
 *
 * This file exports nothing at runtime; it exists for documentation + editor
 * IntelliSense. Import it for side-effect-free `@type` references if desired.
 */

/**
 * @typedef {Object} Landmark
 * @property {number} x  normalized image x in [0,1]
 * @property {number} y  normalized image y in [0,1]
 * @property {number} z  depth — UNRELIABLE on one camera; never used in decisions
 * @property {number} visibility  model confidence in [0,1]
 */

/**
 * @typedef {Object} Frame
 * @property {Landmark[]} landmarks  length 33 (empty array => no pose this frame)
 * @property {number} timestampMs
 */

/**
 * A FrameSource makes the pipeline identical for live camera + real-fixture replay.
 * @typedef {Object} FrameSource
 * @property {() => (Frame|null)} next
 */

/**
 * @typedef {Object} AngleDef
 * @property {string} id
 * @property {[string,string,string]} points  landmark names; vertex is the middle
 * @property {"2d"} plane
 */

/**
 * @typedef {Object} EnterCondition
 * @property {string} signal   angle id, or "<angleId>_vel" for velocity
 * @property {"<"|">"|"approxZeroVel"} op
 * @property {number} value
 * @property {number} hysteresis  dead-zone margin around `value`
 * @property {number} minFrames   frames the condition must hold before switching
 */

/**
 * @typedef {Object} StateDef
 * @property {string} name  STANDING | DESCENDING | BOTTOM | ASCENDING
 * @property {EnterCondition} enterWhen
 */

/**
 * @typedef {Object} RepAngleHistory
 * @property {number} repNumber
 * @property {number} startMs
 * @property {number} endMs
 * @property {Record<string, number[]>} series  per-angle time series over the rep
 * @property {number} [kneeOverAnkleX]  knee-x minus ankle-x at bottom (signed, normalized)
 * @property {number} [torsoLeanMax]    max torso lean (deg from vertical) in the rep
 * @property {number} [bottomMs]     (added Week 3) timestamp of the rep's minimum-angle frame
 * @property {number} [minAngleDeg]  (added Week 3) minimum driving-angle value reached in the rep
 * @property {number} [peakAngleDeg] (added Week 3) max driving-angle value observed in the rep window
 */

/**
 * @typedef {"low"|"medium"|"high"} Severity
 * @typedef {"depth"|"knee_valgus"|"torso_lean"|"tempo"} RuleId
 */

/**
 * @typedef {Object} RuleResult
 * @property {string} ruleId
 * @property {boolean} pass
 * @property {Severity} severity
 * @property {number} measured
 */

/**
 * @typedef {Object} RuleDef
 * @property {RuleId} id
 * @property {number} priority  lower = surfaced first
 * @property {Severity} severity
 * @property {(rep: RepAngleHistory, baseline?: (UserBaseline|null)) => RuleResult} evaluate
 * @property {string} feedbackPass
 * @property {string} feedbackFail
 */

/**
 * (Added Week 3) A bilateral angle group: the rep-counting signal is a
 * single logical value (e.g. "knee"), but the raw skeleton gives two
 * candidate readings (left/right leg). CompositeAngleDef says how to
 * collapse `from` (AngleDef ids) into one number per frame: average the
 * ids that are visible-enough this frame, or fall back to whichever one
 * is visible if only one is — mirrors ExerciseVerifier's per-leg approach.
 * If none of `from` are visible-enough, the composite value is unusable
 * (NaN) for that frame.
 * @typedef {Object} CompositeAngleDef
 * @property {string} id  the logical signal id consumed by states/repCycle (e.g. "knee")
 * @property {string[]} from  AngleDef ids (must exist in drivingAngles) to average/fallback between
 */

/**
 * (Added Week 3) Named, documented hysteresis thresholds driving the
 * STANDING/DESCENDING/BOTTOM/ASCENDING rep cycle for a single composite
 * signal. Kept as a separate explicit block (rather than only encoded via
 * each StateDef's EnterCondition) because the squat rep FSM's transition
 * rules are directional (e.g. "bounce back to STANDING without reaching
 * BOTTOM doesn't count as a rep") and easier to express with one shared
 * down/up pair than four independent EnterConditions. Week 7 will make
 * these per-user-relative instead of fixed degrees.
 * @typedef {Object} RepCycleThresholds
 * @property {string} signal  the CompositeAngleDef/AngleDef id this FSM watches (e.g. "knee")
 * @property {number} downThresholdDeg  must drop below this to be considered BOTTOM
 * @property {number} upThresholdDeg    must rise above this to return to STANDING (upThresholdDeg > downThresholdDeg — the gap is the hysteresis dead-zone)
 * @property {number} minFrames  consecutive frames a transition's condition must hold before it commits (anti-oscillation debounce)
 */

/**
 * @typedef {Object} ExerciseConfig
 * @property {"squat"|"deadlift"|"bench"} id
 * @property {string} displayName
 * @property {boolean} enabled   only squat is true in V1
 * @property {AngleDef[]} drivingAngles
 * @property {CompositeAngleDef[]} [compositeAngles]  (added Week 3) bilateral left/right collapse defs
 * @property {{dominantMotion:"hip_knee"|"elbow_shoulder", minAmplitudeDeg:number}} verification
 * @property {StateDef[]} states
 * @property {string[]} repCycle
 * @property {RepCycleThresholds} [repCycleThresholds]  (added Week 3) the thresholds SquatStateMachine actually reads
 * @property {RuleDef[]} rules
 * @property {{minSec:number, maxSec:number}} tempoBounds
 * @property {Record<RuleId, number>} scoreWeights  sums to 1.0
 */

/**
 * Per-user calibration baseline (Week 7): body proportions + personal ROM +
 * the statistical distribution of the user's own good reps.
 * @typedef {Object} UserBaseline
 * @property {{femurToTorso:number, shinToTorso:number}} limbRatios
 * @property {{kneeStanding:number, kneeBottom:number, hipStanding:number, hipBottom:number}} rom
 * @property {Record<string, {mean:number, std:number}>} angleStats
 * @property {string} calibratedAt  ISO8601
 */

/**
 * @typedef {Object} RepMetrics
 * @property {number} repNumber
 * @property {number} durationSeconds
 * @property {number} romValue
 * @property {number} tempo
 * @property {Record<string, number>} angleMetrics
 */

/**
 * @typedef {Object} IssueRecord
 * @property {number} repNumber
 * @property {RuleId} issueType
 * @property {Severity} severity
 */

/**
 * @typedef {Object} SessionSummary
 * @property {string} exercise
 * @property {string} startedAt
 * @property {string} endedAt
 * @property {number} durationSeconds
 * @property {number} repCount
 * @property {number} formScore
 * @property {RepMetrics[]} reps
 * @property {IssueRecord[]} formIssues
 */

export {}; // keep this an ES module

// Evaluates completed reps against configured form rules.
import { squatConfig } from "@shared/exercise-config/index.js";

// Squat depth target (knee angle in degrees; the rep passes at or below it).
// Personalized: calibrated bottom angle + tolerance, never deeper than the
// safety floor. Shared by the rule and the on-screen baseline label so the
// two can never disagree.
export function squatDepthTargetDeg(depthRule, baselineRom) {
  if (baselineRom?.kneeBottom != null) {
    const personalTarget = Math.round(baselineRom.kneeBottom + (depthRule.tolerance ?? 5));
    return Math.max(personalTarget, depthRule.safetyFloor ?? 70);
  }
  return depthRule.minAngleDeg;
}

export class FormRuleEngine {
  constructor(config = squatConfig) {
    this.config = config;
    this.activityBaseline = null;
    this.baselineRom = null;
    this.baselineLimbRatios = null;
    this.baselineTorsoLean = null;
  }

  // Updates personalized baselines for dynamic rule thresholds.
  setBaseline(baseline) {
    if (baseline?.exercise && baseline.exercise !== this.config.id) baseline = null;
    this.activityBaseline = baseline;
    this.baselineRom = null;
    this.baselineLimbRatios = null;
    this.baselineTorsoLean = null;
    if (baseline?.rom) {
      this.baselineRom = baseline.rom;
      this.baselineTorsoLean = baseline.rom.typicalTorsoLean ?? null;
    }
    if (baseline?.limbRatios) {
      this.baselineLimbRatios = baseline.limbRatios;
    }
    if (baseline?.angleStats?.typical_torso_lean != null) {
      this.baselineTorsoLean = baseline.angleStats.typical_torso_lean;
    }
  }

  // Evaluates form rules for a completed rep.
  evaluate(rep) {
    const results = [];
    const rules = this.config.rules || {};

    const configuredRules = Object.entries(rules).filter(([, rule]) => rule?.metric && rule?.op);
    if (configuredRules.length) {
      for (const [ruleId, rule] of configuredRules) {
        const measured = rule.metric === "romValue"
          ? (rep.romValue ?? Math.abs((rep.peakAngleDeg ?? 0) - (rep.minAngleDeg ?? 0)))
          : rep.angleMetrics?.[rule.metric] ?? rep[rule.metric];
        let threshold = rule.threshold;
        if (this.config.id === "deadlift" && ruleId === "lockout" && Number.isFinite(this.activityBaseline?.rom?.hipLockout)) {
          threshold = Math.max(150, Math.min(rule.threshold, this.activityBaseline.rom.hipLockout - 5));
        } else if (this.config.id === "push_up" && ruleId === "body_alignment" && Number.isFinite(this.activityBaseline?.rom?.bodyLineDeg)) {
          const calibratedDeviation = Math.abs(180 - this.activityBaseline.rom.bodyLineDeg);
          threshold = Math.max(rule.threshold - 5, Math.min(rule.threshold, calibratedDeviation + 5));
        }
        const pass = Number.isFinite(measured) && (
          rule.op === ">=" ? measured >= threshold
            : rule.op === "<=" ? measured <= threshold
              : rule.op === ">" ? measured > threshold
                : rule.op === "<" ? measured < threshold
                  : false
        );
        results.push({ ruleId, pass, severity: rule.severity || "medium", priority: rule.priority || 0,
          measured: Number.isFinite(measured) ? measured : null, threshold, cue: pass ? "" : rule.cue });
      }
      return results;
    }

    if (rules.depth?.enabled) {
      const depthRule = rules.depth;
      const targetDepth = squatDepthTargetDeg(depthRule, this.baselineRom);

      const passed = rep.minAngleDeg <= targetDepth;
      results.push({
        ruleId: "depth",
        pass: passed,
        severity: "high",
        measured: rep.minAngleDeg,
        threshold: targetDepth,
        cue: passed ? "" : depthRule.cue,
      });
    }

    if (rules.torso_lean?.enabled) {
      const leanRule = rules.torso_lean;
      const baseTolerance = leanRule.tolerance ?? 3;
      // Hard safety ceiling — never allow more lean than this.
      const safetyCeiling = leanRule.safetyCeiling ?? 35;

      let maxAllowed;
      if (this.baselineTorsoLean != null) {
        // Personalized: calibrated lean + tolerance.
        let effectiveTolerance = baseTolerance;
        // Long-femur athletes naturally lean more — grant additional tolerance.
        if (this.baselineLimbRatios?.femurToTorso > 1.05) {
          effectiveTolerance += 2;
        }
        const personalMax = Math.round(this.baselineTorsoLean + effectiveTolerance);
        maxAllowed = Math.min(personalMax, safetyCeiling);
      } else {
        maxAllowed = leanRule.maxAngleDeg;
      }

      // torsoLeanMax is recorded by the squat state machine. When the torso
      // was never visible during the rep it is null: report it as unmeasured
      // rather than inventing a 0° lean.
      const measured = Number.isFinite(rep.torsoLeanMax) ? rep.torsoLeanMax : null;
      const passed = measured == null || measured <= maxAllowed;
      results.push({
        ruleId: "torso_lean",
        pass: passed,
        notMeasured: measured == null,
        severity: "medium",
        measured,
        threshold: maxAllowed,
        cue: passed ? "" : leanRule.cue,
      });
    }

    if (rules.knee_valgus?.enabled) {
      // Only present when the squat state machine saw a front-view frame.
      const ratio = rep.angleMetrics?.kneeAnkleRatio;
      const measured = Number.isFinite(ratio) ? ratio : null;
      const threshold = rules.knee_valgus.minKneeAnkleRatio ?? 0.9;
      const passed = measured == null || measured >= threshold;
      results.push({
        ruleId: "knee_valgus",
        pass: passed,
        notMeasured: measured == null,
        severity: "medium",
        measured,
        threshold,
        cue: passed ? "" : rules.knee_valgus.cue,
      });
    }

    if (rules.tempo?.enabled && this.config.tempoBounds) {
      // Whole-rep duration must fall inside the configured tempo bounds:
      // faster than minSec is a bounce/drop, slower than maxSec is a stall.
      const { minSec, maxSec } = this.config.tempoBounds;
      const measured = Number.isFinite(rep.endMs) && Number.isFinite(rep.startMs)
        ? (rep.endMs - rep.startMs) / 1000
        : null;
      const passed = measured != null && measured >= minSec && measured <= maxSec;
      results.push({
        ruleId: "tempo",
        pass: passed,
        severity: "low",
        measured,
        threshold: measured != null && measured < minSec ? minSec : maxSec,
        cue: passed ? "" : rules.tempo.cue,
      });
    }

    return results;
  }
}

// Computes 0-100 form score mirroring backend app.services.form_score.compute_form_score.
// measuredBy maps a rule to the angle metric that proves it was measured on a
// rep (e.g. knee_valgus -> kneeAnkleRatio). Such a rule's pass rate uses only
// reps where it was measured; a rule measured on no rep is left out and the
// remaining weights are rescaled.
export function calculateFormScore(reps = [], formIssues = [], weights = squatConfig.scoreWeights, measuredBy = {}) {
  const totalReps = reps.length;
  if (totalReps === 0) return 100.0;

  const failingRepNumbersByRule = {};
  for (const rule of Object.keys(weights)) {
    failingRepNumbersByRule[rule] = new Set();
  }

  for (const issue of formIssues) {
    const rule = issue.issueType || issue.issue_type;
    const repNum = issue.repNumber || issue.rep_number;
    if (failingRepNumbersByRule[rule]) {
      failingRepNumbersByRule[rule].add(repNum);
    }
  }

  let score = 0.0;
  let usedWeight = 0.0;
  for (const [rule, weight] of Object.entries(weights)) {
    const failing = failingRepNumbersByRule[rule];
    const metric = measuredBy?.[rule];
    let considered = totalReps;
    if (metric) {
      const measured = new Set(failing);
      for (const rep of reps) {
        const metrics = rep.angleMetrics || rep.angle_metrics || {};
        if (metric in metrics) measured.add(rep.repNumber ?? rep.rep_number);
      }
      considered = measured.size;
      if (considered === 0) continue;
    }
    score += weight * ((considered - failing.size) / considered);
    usedWeight += weight;
  }

  if (usedWeight === 0) return 100.0;
  return Math.round((score / usedWeight) * 10000) / 100;
}

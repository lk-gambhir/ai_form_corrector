// Evaluates completed reps against configured form rules.
import { squatConfig } from "@shared/exercise-config/index.js";

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
      const tolerance = depthRule.tolerance ?? 5;
      // Hard safety floor — never require depth below this angle (lower angle = deeper).
      const safetyFloor = depthRule.safetyFloor ?? 70;

      let targetDepth;
      if (this.baselineRom?.kneeBottom != null) {
        // Personalized: calibrated bottom angle + tolerance.
        // Clamp to safety floor so nobody is forced dangerously deep.
        const personalTarget = Math.round(this.baselineRom.kneeBottom + tolerance);
        targetDepth = Math.max(personalTarget, safetyFloor);
      } else {
        targetDepth = depthRule.minAngleDeg;
      }

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

      const measured = rep.torsoLeanMax ?? 0;
      const passed = measured <= maxAllowed;
      results.push({
        ruleId: "torso_lean",
        pass: passed,
        severity: "medium",
        measured: measured,
        threshold: maxAllowed,
        cue: passed ? "" : leanRule.cue,
      });
    }

    return results;
  }
}

// Computes 0-100 form score mirroring backend app.services.form_score.compute_form_score.
export function calculateFormScore(reps = [], formIssues = [], weights = squatConfig.scoreWeights) {
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
  for (const [rule, weight] of Object.entries(weights)) {
    const failed = failingRepNumbersByRule[rule] ? failingRepNumbersByRule[rule].size : 0;
    const passRate = (totalReps - failed) / totalReps;
    score += weight * passRate;
  }

  return Math.round(score * 10000) / 100;
}

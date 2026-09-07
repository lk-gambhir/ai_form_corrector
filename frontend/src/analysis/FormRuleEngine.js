// Evaluates completed reps against configured form rules.
import { squatConfig } from "@shared/exercise-config/squat.config.js";

export class FormRuleEngine {
  constructor(config = squatConfig) {
    this.config = config;
    this.baselineRom = null;
  }

  // Updates personalized range-of-motion baseline for dynamic rule thresholds.
  setBaseline(baseline) {
    if (baseline?.rom) {
      this.baselineRom = baseline.rom;
    }
  }

  // Evaluates form rules for a completed rep.
  evaluate(rep) {
    const results = [];
    const rules = this.config.rules || {};

    if (rules.depth?.enabled) {
      // Use calibrated bottom depth if available, otherwise config default.
      const targetDepth = this.baselineRom?.kneeBottom
        ? Math.min(rules.depth.minAngleDeg, Math.round(this.baselineRom.kneeBottom + 5))
        : rules.depth.minAngleDeg;
      const passed = rep.minAngleDeg <= targetDepth;
      results.push({
        ruleId: "depth",
        pass: passed,
        severity: "high",
        measured: rep.minAngleDeg,
        cue: passed ? "" : rules.depth.cue,
      });
    }

    if (rules.torso_lean?.enabled) {
      const measured = rep.torsoLeanMax ?? 0;
      const passed = measured <= rules.torso_lean.maxAngleDeg;
      results.push({
        ruleId: "torso_lean",
        pass: passed,
        severity: "medium",
        measured: measured,
        cue: passed ? "" : rules.torso_lean.cue,
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

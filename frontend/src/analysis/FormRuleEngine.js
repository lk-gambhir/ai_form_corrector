// Evaluates completed reps against configured form rules.
import { squatConfig } from "@shared/exercise-config/squat.config.js";

export class FormRuleEngine {
  // Evaluates form rules for a completed rep.
  evaluate(rep) {
    const results = [];
    const rules = squatConfig.rules;

    if (rules.depth && rules.depth.enabled) {
      const passed = rep.minAngleDeg <= rules.depth.minAngleDeg;
      results.push({
        ruleId: "depth",
        pass: passed,
        severity: "high",
        measured: rep.minAngleDeg,
        cue: passed ? "" : rules.depth.cue,
      });
    }

    if (rules.torso_lean && rules.torso_lean.enabled) {
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

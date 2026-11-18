// Orchestrates frame analysis: LandmarkSmoother -> SquatStateMachine -> FormRuleEngine -> MetricsEngine -> FeedbackSelector.
import { LandmarkSmoother } from "@/pose/LandmarkSmoother.js";
import { FormRuleEngine } from "@/analysis/FormRuleEngine.js";
import { MetricsEngine } from "@/analysis/MetricsEngine.js";
import { FeedbackSelector } from "@/analysis/FeedbackSelector.js";
import { squatConfig, getExerciseConfig } from "@shared/exercise-config/index.js";
import { SquatStateMachine } from "../../../exercises/squat/frontend/StateMachine.js";
import { PushUpStateMachine } from "../../../exercises/push_up/frontend/StateMachine.js";
import { DeadliftStateMachine } from "../../../exercises/deadlift/frontend/StateMachine.js";

const DETECTORS_BY_EXERCISE = Object.freeze({
  squat: SquatStateMachine,
  push_up: PushUpStateMachine,
  deadlift: DeadliftStateMachine,
});

export class AnalysisPipeline {
  constructor(config = squatConfig) {
    this.config = config;
    this.smoother = new LandmarkSmoother();
    const Detector = DETECTORS_BY_EXERCISE[config.id];
    if (!Detector || !getExerciseConfig(config.id)) throw new Error(`Unsupported exercise config: ${config.id}`);
    this.machine = new Detector(config);
    this.ruleEngine = new FormRuleEngine(config);
    this.metricsEngine = new MetricsEngine();
    this.feedbackSelector = new FeedbackSelector();
  }

  // Configures pipeline with calibrated user baseline ROM thresholds.
  setBaseline(baseline) {
    if (baseline?.exercise && baseline.exercise !== this.config.id) {
      this.ruleEngine.setBaseline(baseline);
      return;
    }
    if (!baseline?.rom) {
      this.ruleEngine.setBaseline(null);
      return;
    }
    this.ruleEngine.setBaseline(baseline);

    const { kneeStanding, kneeBottom } = baseline.rom;
    if (typeof kneeStanding === "number" && typeof kneeBottom === "number") {
      const range = kneeStanding - kneeBottom;
      if (range > 15) {
        const upThresholdDeg = Math.round(kneeStanding - range * 0.2);
        const downThresholdDeg = Math.round(kneeStanding - range * 0.6);
        this.machine.updateThresholds({ downThresholdDeg, upThresholdDeg });
      }
    }
  }

  // Processes a frame and returns updated analysis state, rep count, feedback, metrics, and new issues.
  processFrame(landmarks, timestampMs) {
    const smoothed = this.smoother.smooth(landmarks);
    this.machine.update({ landmarks: smoothed, timestampMs });

    const reps = this.machine.getReps();
    const lastRep = reps[reps.length - 1];

    let feedback = { activeCue: null, severity: null };
    let metrics = null;
    let newIssues = [];

    if (lastRep && lastRep.endMs === timestampMs) {
      const ruleResults = this.ruleEngine.evaluate(lastRep);
      feedback = this.feedbackSelector.select(ruleResults);
      metrics = this.metricsEngine.compute(lastRep);
      newIssues = ruleResults
        .filter((r) => !r.pass)
        .map((r) => ({
          repNumber: lastRep.repNumber,
          issueType: r.ruleId,
          severity: r.severity || "medium",
        }));
    }

    return {
      state: this.machine.state,
      repCount: this.machine.repCount,
      feedback,
      metrics,
      newIssues,
    };
  }

  // Resets pipeline components.
  reset() {
    this.machine.reset();
    this.smoother.reset();
    this.feedbackSelector.reset?.();
  }
}

// Replays a fixture through a frame source and advances the state machine.
export function runSquatFixture(fixtureData, FrameSourceClass, machine) {
  const source = new FrameSourceClass(fixtureData);
  while (true) {
    const frame = source.next();
    if (!frame) break;
    machine.update({ landmarks: frame.landmarks, timestampMs: frame.timestampMs });
  }
  return machine;
}

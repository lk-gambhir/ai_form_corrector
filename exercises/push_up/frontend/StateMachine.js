import { ActivityStateMachine } from "../../../frontend/src/analysis/ActivityStateMachine.js";

/** Push-up rep adapter; thresholds and elbow/body-line signals live in its config. */
export class PushUpStateMachine extends ActivityStateMachine {
  constructor(config) {
    if (config?.id !== "push_up") throw new Error("PushUpStateMachine requires the push_up config");
    super(config);
  }
}

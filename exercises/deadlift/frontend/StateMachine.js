import { ActivityStateMachine } from "../../../frontend/src/analysis/ActivityStateMachine.js";

/** Deadlift rep adapter; the config inverts hip angle into the hinge signal. */
export class DeadliftStateMachine extends ActivityStateMachine {
  constructor(config) {
    if (config?.id !== "deadlift") throw new Error("DeadliftStateMachine requires the deadlift config");
    super(config);
  }
}

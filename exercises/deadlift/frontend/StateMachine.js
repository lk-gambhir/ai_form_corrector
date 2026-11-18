import { ActivityStateMachine } from "../../../frontend/src/analysis/ActivityStateMachine.js";

/** Deadlift rep adapter; the hip angle rises from floor setup to lockout (see config.cycle). */
export class DeadliftStateMachine extends ActivityStateMachine {
  constructor(config) {
    if (config?.id !== "deadlift") throw new Error("DeadliftStateMachine requires the deadlift config");
    super(config);
  }
}

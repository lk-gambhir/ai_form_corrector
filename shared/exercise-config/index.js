// Central exercise registry consumed by the dashboard and workout flow.
import { squatConfig } from "../../exercises/squat/config/exercise.config.js";
import { pushupConfig } from "../../exercises/push_up/config/exercise.config.js";
import { deadliftConfig } from "../../exercises/deadlift/config/exercise.config.js";

export { squatConfig, pushupConfig, deadliftConfig };

export const exerciseRegistry = Object.freeze({
  [squatConfig.id]: squatConfig,
  [pushupConfig.id]: pushupConfig,
  [deadliftConfig.id]: deadliftConfig,
});

export function getExerciseConfig(id) {
  return exerciseRegistry[id] || null;
}

export function listSupportedExercises() {
  return Object.values(exerciseRegistry).filter((exercise) => exercise.enabled);
}

export default exerciseRegistry;

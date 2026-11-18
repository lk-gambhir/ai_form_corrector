// Calibration baseline persistence API calls.
import { apiRequest } from "./client.js";

export async function saveBaseline(baseline, exercise = baseline.exercise || "squat") {
  const payload = {
    exercise,
    limb_ratios: baseline.limbRatios || baseline.limb_ratios || {},
    rom: baseline.rom || {},
    angle_stats: baseline.angleStats || baseline.angle_stats || {},
  };
  return apiRequest("/calibration", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getBaseline(exercise = "squat") {
  return apiRequest(`/calibration?exercise=${encodeURIComponent(exercise)}`);
}

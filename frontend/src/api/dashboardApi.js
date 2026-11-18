// Dashboard statistics and metrics trend API calls.
import { apiRequest } from "./client.js";

export async function getDashboardSummary(exercise) {
  const query = exercise ? `?exercise=${encodeURIComponent(exercise)}` : "";
  return apiRequest(`/dashboard/summary${query}`);
}

export async function getDashboardTrends(metric = "form_score", exercise) {
  const params = new URLSearchParams({ metric });
  if (exercise) params.set("exercise", exercise);
  return apiRequest(`/dashboard/trends?${params}`);
}

/**
 * Pure geometry helpers for 2D joint angles from MediaPipe Pose landmarks.
 *
 * Per shared/exercise-config/landmarks.js: `z` is never load-bearing. Every
 * angle here uses (x, y) only.
 */

import { POSE_LANDMARKS } from "@shared/exercise-config/landmarks.js";

/**
 * Angle in degrees at `vertex`, formed by rays vertex->a and vertex->c,
 * using 2D (x, y) coordinates only.
 *
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} vertex
 * @param {{x:number,y:number}} c
 * @returns {number} degrees in [0, 180], or NaN if degenerate (zero-length vector or missing input)
 */
export function jointAngle2D(a, vertex, c) {
  if (!a || !vertex || !c) return NaN;

  const v1x = a.x - vertex.x;
  const v1y = a.y - vertex.y;
  const v2x = c.x - vertex.x;
  const v2y = c.y - vertex.y;

  const mag1 = Math.hypot(v1x, v1y);
  const mag2 = Math.hypot(v2x, v2y);

  if (mag1 === 0 || mag2 === 0) return NaN;

  const dot = v1x * v2x + v1y * v2y;
  // Clamp for floating-point safety before acos.
  const cos = Math.min(1, Math.max(-1, dot / (mag1 * mag2)));

  return (Math.acos(cos) * 180) / Math.PI;
}

/**
 * @param {{visibility?: number}} landmark
 * @param {number} [threshold=0.5]
 * @returns {boolean}
 */
export function landmarkVisibleEnough(landmark, threshold = 0.5) {
  if (!landmark || typeof landmark.visibility !== "number") return false;
  return landmark.visibility >= threshold;
}

/**
 * Resolve an AngleDef's three landmark names against POSE_LANDMARKS and
 * compute the 2D angle at the middle (vertex) point.
 *
 * @param {import("@shared/exercise-config/types.js").Landmark[]} landmarks length-33 array
 * @param {import("@shared/exercise-config/types.js").AngleDef[]} angleDefs
 * @returns {Record<string, number>} angleId -> degrees (NaN if unresolvable)
 */
export function computeAngles(landmarks, angleDefs) {
  const result = {};
  if (!Array.isArray(landmarks) || !Array.isArray(angleDefs)) return result;

  for (const def of angleDefs) {
    const [aName, vertexName, cName] = def.points;
    const aIdx = POSE_LANDMARKS[aName];
    const vIdx = POSE_LANDMARKS[vertexName];
    const cIdx = POSE_LANDMARKS[cName];

    if (aIdx === undefined || vIdx === undefined || cIdx === undefined) {
      result[def.id] = NaN;
      continue;
    }

    result[def.id] = jointAngle2D(landmarks[aIdx], landmarks[vIdx], landmarks[cIdx]);
  }

  return result;
}

/**
 * Canvas rendering for pose landmarks: dots + a basic skeleton.
 * Landmarks are normalized [0,1]; this module maps them to canvas pixels.
 */

import { POSE_LANDMARKS } from "@shared/exercise-config/landmarks.js";

// Pairs of landmark names to connect with a line. Covers the upper + lower
// body chain the squat pipeline cares about (shoulders-hips-knees-ankles,
// elbows-wrists).
const SKELETON_CONNECTIONS = [
  ["LEFT_SHOULDER", "RIGHT_SHOULDER"],
  ["LEFT_SHOULDER", "LEFT_ELBOW"],
  ["LEFT_ELBOW", "LEFT_WRIST"],
  ["RIGHT_SHOULDER", "RIGHT_ELBOW"],
  ["RIGHT_ELBOW", "RIGHT_WRIST"],
  ["LEFT_SHOULDER", "LEFT_HIP"],
  ["RIGHT_SHOULDER", "RIGHT_HIP"],
  ["LEFT_HIP", "RIGHT_HIP"],
  ["LEFT_HIP", "LEFT_KNEE"],
  ["LEFT_KNEE", "LEFT_ANKLE"],
  ["RIGHT_HIP", "RIGHT_KNEE"],
  ["RIGHT_KNEE", "RIGHT_ANKLE"],
];

const DOT_RADIUS = 4;
const DOT_COLOR = "#4ade80";
const LINE_COLOR = "#4ade80";
const LINE_WIDTH = 2;
const MIN_VISIBILITY = 0.5;

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array<{x:number,y:number,visibility?:number}>} landmarks normalized coords
 * @param {number} width canvas width in px
 * @param {number} height canvas height in px
 */
export function drawPose(ctx, landmarks, width, height) {
  if (!ctx || !Array.isArray(landmarks) || landmarks.length === 0) return;

  const toPixel = (lm) => ({ x: lm.x * width, y: lm.y * height });
  const isVisible = (lm) => lm && (lm.visibility === undefined || lm.visibility >= MIN_VISIBILITY);

  ctx.strokeStyle = LINE_COLOR;
  ctx.lineWidth = LINE_WIDTH;
  for (const [fromName, toName] of SKELETON_CONNECTIONS) {
    const from = landmarks[POSE_LANDMARKS[fromName]];
    const to = landmarks[POSE_LANDMARKS[toName]];
    if (!isVisible(from) || !isVisible(to)) continue;

    const p1 = toPixel(from);
    const p2 = toPixel(to);
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
  }

  ctx.fillStyle = DOT_COLOR;
  for (const lm of landmarks) {
    if (!isVisible(lm)) continue;
    const p = toPixel(lm);
    ctx.beginPath();
    ctx.arc(p.x, p.y, DOT_RADIUS, 0, 2 * Math.PI);
    ctx.fill();
  }
}

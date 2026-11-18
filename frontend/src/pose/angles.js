// 2D joint angle calculations from pose landmarks.
import { POSE_LANDMARKS } from "@shared/exercise-config/landmarks.js";

// MediaPipe landmarks are normalized separately per axis: x = px / width,
// y = px / height. On a non-square frame (e.g. a 16:9 webcam) that squashes
// horizontal distances relative to vertical ones, which distorts every angle.
// Rescale x (and z, which MediaPipe puts on roughly the same scale as x) by
// width / height so one unit means the same length on every axis.
// Drawing code should keep using the raw normalized landmarks.
export function toSquareUnits(landmarks, aspectRatio) {
  if (!Array.isArray(landmarks) || !(aspectRatio > 0) || aspectRatio === 1) return landmarks;
  return landmarks.map((lm) => (lm
    ? { ...lm, x: lm.x * aspectRatio, z: Number.isFinite(lm.z) ? lm.z * aspectRatio : lm.z }
    : lm));
}

// Computes 2D joint angle in degrees formed by rays vertex->a and vertex->c.
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
  const cos = Math.min(1, Math.max(-1, dot / (mag1 * mag2)));

  return (Math.acos(cos) * 180) / Math.PI;
}

// Checks if landmark visibility meets threshold.
export function landmarkVisibleEnough(landmark, threshold = 0.5) {
  if (!landmark || typeof landmark.visibility !== "number") return false;
  return landmark.visibility >= threshold;
}

// Torso lean in degrees from vertical (hip -> shoulder), using the more
// visible body side. Same formula as CalibrationEngine.computeTorsoLean so
// live measurements are comparable with the calibrated baseline.
// Returns NaN when the shoulder/hip pair is not visible enough.
export function torsoLeanDeg(landmarks, threshold = 0.5) {
  if (!Array.isArray(landmarks)) return NaN;
  const vis = (name) => landmarks[POSE_LANDMARKS[name]]?.visibility ?? 0;
  const side = vis("LEFT_SHOULDER") + vis("LEFT_HIP") >= vis("RIGHT_SHOULDER") + vis("RIGHT_HIP") ? "LEFT" : "RIGHT";
  const shoulder = landmarks[POSE_LANDMARKS[`${side}_SHOULDER`]];
  const hip = landmarks[POSE_LANDMARKS[`${side}_HIP`]];
  if (!landmarkVisibleEnough(shoulder, threshold) || !landmarkVisibleEnough(hip, threshold)) return NaN;
  const dx = shoulder.x - hip.x;
  const dy = shoulder.y - hip.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.01) return NaN;
  return (Math.acos(Math.min(1, Math.abs(dy) / length)) * 180) / Math.PI;
}

// How far the body is turned away from facing the camera, in degrees
// (0 = shoulders and hips square to the camera, 90 = side-on). Uses the
// MediaPipe landmark depth z, which the Pose Landmarker documents as being on
// roughly the same scale as x, so no image aspect-ratio correction is needed.
// Averages the shoulder line and the hip line.
export function bodyYawDeg(landmarks) {
  if (!Array.isArray(landmarks)) return NaN;
  const lineYaw = (a, b) => {
    const p = landmarks[POSE_LANDMARKS[a]];
    const q = landmarks[POSE_LANDMARKS[b]];
    if (!p || !q || !Number.isFinite(p.z) || !Number.isFinite(q.z)) return NaN;
    return (Math.atan2(Math.abs(p.z - q.z), Math.abs(p.x - q.x)) * 180) / Math.PI;
  };
  return (lineYaw("LEFT_SHOULDER", "RIGHT_SHOULDER") + lineYaw("LEFT_HIP", "RIGHT_HIP")) / 2;
}

// Knee-to-ankle separation ratio (KASR): horizontal distance between the
// knees divided by horizontal distance between the ankles (Mizner et al.
// 2012). 1.0 = knees directly over ankles; < 1.0 = knees closer together than
// ankles (valgus). Only x distances are used, so image aspect ratio cancels.
// Only valid from a front (or back) view: returns NaN when the body is turned
// more than maxYawDeg from the camera or a hip/knee/ankle/shoulder is hidden.
export function kneeAnkleRatio(landmarks, threshold = 0.5, maxYawDeg = 25) {
  if (!Array.isArray(landmarks)) return NaN;
  const names = [
    "LEFT_SHOULDER", "RIGHT_SHOULDER", "LEFT_HIP", "RIGHT_HIP",
    "LEFT_KNEE", "RIGHT_KNEE", "LEFT_ANKLE", "RIGHT_ANKLE",
  ];
  if (!names.every((name) => landmarkVisibleEnough(landmarks[POSE_LANDMARKS[name]], threshold))) return NaN;
  if (!(bodyYawDeg(landmarks) <= maxYawDeg)) return NaN;
  const sep = (a, b) => Math.abs(landmarks[POSE_LANDMARKS[a]].x - landmarks[POSE_LANDMARKS[b]].x);
  const ankleSep = sep("LEFT_ANKLE", "RIGHT_ANKLE");
  if (ankleSep < 0.01) return NaN;
  return sep("LEFT_KNEE", "RIGHT_KNEE") / ankleSep;
}

// Computes angles for a list of AngleDefs from landmarks.
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

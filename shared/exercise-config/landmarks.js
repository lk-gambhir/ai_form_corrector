/**
 * MediaPipe Pose (BlazePose) 33-landmark index map.
 * We name the ones the squat pipeline uses, plus the total count.
 *
 * NOTE (PRD §22, ARCHITECTURE §31): the `z` coordinate from a single webcam is
 * NOT reliable. Every angle/rule in this project uses 2D (x, y) only. `z` is
 * carried through and stored, but never load-bearing in a decision.
 */

export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

/** Total landmarks emitted by the model. */
export const LANDMARK_COUNT = 33;

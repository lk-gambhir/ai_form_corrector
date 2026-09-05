/**
 * Thin wrapper over @mediapipe/tasks-vision PoseLandmarker (the current
 * Tasks API — NOT the deprecated @mediapipe/pose package).
 */

import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";

// Matches the CDN version pinned in package.json (@mediapipe/tasks-vision).
const WASM_FILESET_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm";

export class PoseEstimator {
  /** @param {PoseLandmarker} landmarker */
  constructor(landmarker) {
    this._landmarker = landmarker;
  }

  /**
   * @param {{modelAssetPath?: string, numPoses?: number}} [options]
   * @returns {Promise<PoseEstimator>}
   */
  static async create({ modelAssetPath = "/models/pose_landmarker_lite.task", numPoses = 1 } = {}) {
    let vision;
    try {
      vision = await FilesetResolver.forVisionTasks(WASM_FILESET_URL);
    } catch (err) {
      throw new Error(`PoseEstimator: failed to load MediaPipe WASM fileset: ${err.message}`);
    }

    let landmarker;
    try {
      landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath,
        },
        runningMode: "VIDEO",
        numPoses,
      });
    } catch (err) {
      throw new Error(
        `PoseEstimator: failed to load pose model at "${modelAssetPath}". ` +
          `Make sure the .task file exists (see README for the download step). Cause: ${err.message}`
      );
    }

    return new PoseEstimator(landmarker);
  }

  /**
   * Run detection on the current video frame.
   * @param {HTMLVideoElement} videoEl
   * @param {number} timestampMs monotonically increasing timestamp
   * @returns {Array<{x:number,y:number,z:number,visibility:number}>} 33 landmarks, or [] if none detected
   */
  detectForVideo(videoEl, timestampMs) {
    if (!this._landmarker) return [];

    const result = this._landmarker.detectForVideo(videoEl, timestampMs);
    const normalizedLandmarks = result?.landmarks?.[0];
    if (!normalizedLandmarks || normalizedLandmarks.length === 0) return [];

    return normalizedLandmarks.map((lm) => ({
      x: lm.x,
      y: lm.y,
      z: lm.z,
      visibility: lm.visibility ?? 0,
    }));
  }

  close() {
    if (this._landmarker) {
      this._landmarker.close();
      this._landmarker = null;
    }
  }
}

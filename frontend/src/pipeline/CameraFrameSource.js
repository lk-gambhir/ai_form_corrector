/**
 * A FrameSource (see shared/exercise-config/types.js) that adapts a live
 * PoseEstimator + HTMLVideoElement pair to the same `{next()}` interface
 * ReplayFrameSource exposes, so the pipeline built in Week 2 can run
 * unmodified against a live camera in a later week (CameraView currently
 * drives PoseEstimator directly — this adapter is the seam that lets that
 * be swapped for a FrameSource-based pipeline without touching this file
 * again).
 *
 * Intentionally thin: no test coverage requirement per the Week 2 spec
 * (it needs a real <video>/camera to exercise meaningfully), but it is
 * exercised implicitly by construction here to keep it in sync with
 * PoseEstimator's interface.
 */
export class CameraFrameSource {
  /**
   * @param {import("@/pose/PoseEstimator.js").PoseEstimator} poseEstimator
   * @param {HTMLVideoElement} videoEl
   */
  constructor(poseEstimator, videoEl) {
    this._estimator = poseEstimator;
    this._video = videoEl;
  }

  /**
   * @returns {{landmarks: any[], timestampMs: number}}
   */
  next() {
    const timestampMs = performance.now();
    const landmarks = this._estimator.detectForVideo(this._video, timestampMs);
    return { landmarks, timestampMs };
  }
}

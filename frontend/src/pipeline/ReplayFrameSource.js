/**
 * A FrameSource (see shared/exercise-config/types.js) that replays a
 * previously-recorded fixture (see frontend/src/fixtures/*.json,
 * GROUND_TRUTH.md) frame-by-frame, so the rest of the pipeline (smoother,
 * verifier, rep-counter, ...) can run identically over live camera frames
 * or over a real recorded pose sequence.
 *
 * Fixture shape: `{ source, license, fps, width, height, frames: [ { t, landmarks } ] }`.
 *
 * Timestamp unit note: the fixtures' `frame.t` is already in MILLISECONDS,
 * not seconds, despite `t` reading like a short name for "time in seconds".
 * Verified against both real fixtures: real-squat-good.json is 213 frames
 * at 30fps and its last frame has t=7066.67 (== (213-1)/30*1000 ms, matching
 * GROUND_TRUTH.md's "~7.1s" duration); real-squat-shallow.json is 539
 * frames at ~14.985fps and its last frame has t=35902.5 (matches
 * GROUND_TRUTH.md's "~36.0s"/"35.9s"). If `t` were seconds those values
 * would be ~7.07 and ~35.9 respectively, not thousands. So `timestampMs` is
 * emitted as `frame.t` directly (no *1000 multiplication).
 *
 * Dropout frames (frame.landmarks.length < 33, real in both fixtures — see
 * GROUND_TRUTH.md) pass through unchanged as `{ landmarks: [], timestampMs }`
 * (or whatever short array was recorded) so downstream code (smoother,
 * verifier) sees the same dropout a live stream would produce.
 */
export class ReplayFrameSource {
  /**
   * @param {{fps?:number, frames: Array<{t:number, landmarks: any[]}>}} fixtureJson
   */
  constructor(fixtureJson) {
    if (!fixtureJson || !Array.isArray(fixtureJson.frames)) {
      throw new Error("ReplayFrameSource: fixtureJson.frames must be an array");
    }
    this._frames = fixtureJson.frames;
    this._index = 0;
  }

  /**
   * @returns {{landmarks: any[], timestampMs: number}|null} null once exhausted
   */
  next() {
    if (this._index >= this._frames.length) return null;
    const frame = this._frames[this._index];
    this._index += 1;
    return {
      // Shallow-copy so a downstream stage mutating the array in place can't
      // corrupt the shared imported fixture JSON across reset()+replay or
      // between tests importing the same module.
      landmarks: Array.isArray(frame.landmarks) ? frame.landmarks.slice() : [],
      timestampMs: frame.t,
    };
  }

  reset() {
    this._index = 0;
  }
}

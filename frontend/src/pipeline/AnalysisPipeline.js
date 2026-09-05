/**
 * Thin pipeline wiring (Week 3). Chains a FrameSource (live camera or
 * ReplayFrameSource) through LandmarkSmoother into any per-frame consumer
 * (ExerciseVerifier.update, SquatStateMachine.update, ...), mirroring how
 * the real live pipeline will be assembled once CameraFrameSource is wired
 * up to the UI (later week). Kept minimal — the full pipeline (multi-stage,
 * UI-connected) is fleshed out in Week 5.
 */

import { LandmarkSmoother } from "@/pose/LandmarkSmoother.js";

/**
 * Pump every frame out of `source`, smoothing each one, and hand the
 * smoothed landmarks + original timestamp to `onFrame`. Stops when
 * `source.next()` returns null (fixture exhausted / live stream ended).
 *
 * @param {import("@shared/exercise-config/types.js").FrameSource} source
 * @param {{onFrame?: (frame:{landmarks:any[], timestampMs:number}) => void, smoother?: LandmarkSmoother}} [options]
 * @returns {number} total frames pumped
 */
export function run(source, { onFrame, smoother } = {}) {
  const sm = smoother ?? new LandmarkSmoother();
  let count = 0;
  let frame;
  while ((frame = source.next()) !== null) {
    const smoothed = sm.smooth(frame.landmarks);
    onFrame?.({ landmarks: smoothed, timestampMs: frame.timestampMs });
    count += 1;
  }
  return count;
}

/**
 * Convenience wiring for tests/tools: ReplayFrameSource(fixtureJson) ->
 * LandmarkSmoother -> SquatStateMachine(config), fully drained.
 *
 * @param {any} fixtureJson  a fixture matching ReplayFrameSource's expected shape
 * @param {new (...args:any[]) => {next: () => any}} FrameSourceCtor  e.g. ReplayFrameSource
 * @param {import("@/analysis/SquatStateMachine.js").SquatStateMachine} machine
 * @param {{alpha?: number, visibilityThreshold?: number}} [smootherOptions]
 * @returns {import("@/analysis/SquatStateMachine.js").SquatStateMachine} the same machine, fully advanced
 */
export function runSquatFixture(fixtureJson, FrameSourceCtor, machine, smootherOptions = {}) {
  const source = new FrameSourceCtor(fixtureJson);
  const smoother = new LandmarkSmoother(smootherOptions);
  run(source, { smoother, onFrame: (frame) => machine.update(frame) });
  return machine;
}

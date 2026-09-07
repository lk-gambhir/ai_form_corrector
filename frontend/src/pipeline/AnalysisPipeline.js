// Frame pipeline runner for pose smoothing and state machine updates.
import { LandmarkSmoother } from "@/pose/LandmarkSmoother.js";

// Streams frames through smoother and into onFrame callback.
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

// Replays a fixture through smoother into the squat state machine.
export function runSquatFixture(fixtureJson, FrameSourceCtor, machine, smootherOptions = {}) {
  const source = new FrameSourceCtor(fixtureJson);
  const smoother = new LandmarkSmoother(smootherOptions);
  run(source, { smoother, onFrame: (frame) => machine.update(frame) });
  return machine;
}

// Calculates temporal and kinematic metrics for completed reps.
export class MetricsEngine {
  // Computes duration, ROM delta, and tempo for a completed rep.
  compute(rep) {
    const durationSeconds = (rep.endMs - rep.startMs) / 1000;
    const firstPhaseSeconds = (rep.bottomMs - rep.startMs) / 1000;
    const returnPhaseSeconds = (rep.endMs - rep.bottomMs) / 1000;
    const romValue = Number.isFinite(rep.romValue)
      ? rep.romValue
      : rep.peakAngleDeg - rep.minAngleDeg;

    return {
      repNumber: rep.repNumber,
      durationSeconds,
      romValue,
      tempo: returnPhaseSeconds > 0 ? firstPhaseSeconds / returnPhaseSeconds : 0,
      angleMetrics: {
        ...(rep.angleMetrics || {}),
        minAngle: rep.minAngleDeg,
        peakAngle: rep.peakAngleDeg,
      },
    };
  }
}

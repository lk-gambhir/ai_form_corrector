/*
 * TEMPORARY PERFORMANCE INSTRUMENTATION
 * Remove this file and the marked CameraView hooks after the live benchmark.
 * This module only records timings; it does not change pose thresholds, scoring,
 * rep-counting, or user-facing behavior.
 */

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((sorted.length - 1) * p));
  return sorted[index];
}

function average(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatNumber(value, digits = 2) {
  return value == null ? "pending" : Number(value.toFixed(digits));
}

function markdownTable(rows) {
  return [
    "| Metric | Result |",
    "|---|---:|",
    ...rows.map(([metric, result]) => `| ${metric} | ${result} |`),
  ].join("\n");
}

export function createTemporaryPerformanceMonitor({ durationMs = 60_000 } = {}) {
  const poseProcessingMs = [];
  const endToEndLatencyMs = [];
  let startedAt = null;
  let active = false;
  let finished = false;
  let deadlineReached = false;
  let pendingUiFrame = null;
  let appRepCountAtEnd = null;
  let latestRepCount = null;
  let manualSetStartRepCount = null;
  let appRepCountForManualSet = null;
  let manualRepCount = null;
  let manualRepNote = "Manual 20-rep count not recorded";

  const monitor = {
    startSession() {
      poseProcessingMs.length = 0;
      endToEndLatencyMs.length = 0;
      startedAt = performance.now();
      active = true;
      finished = false;
      deadlineReached = false;
      pendingUiFrame = null;
      appRepCountAtEnd = null;
      latestRepCount = null;
      manualSetStartRepCount = null;
      appRepCountForManualSet = null;
      manualRepCount = null;
      manualRepNote = "Manual 20-rep count not recorded";
    },

    startFrame(captureTimestamp) {
      if (!active || startedAt == null) return true;
      return !finished && captureTimestamp - startedAt <= durationMs;
    },

    recordPoseFrame({ captureTimestamp, detectionStarted, detectionDone, repCountDone }) {
      if (!active || finished || startedAt == null) return;
      if (captureTimestamp - startedAt > durationMs) {
        deadlineReached = true;
        return;
      }

      poseProcessingMs.push(detectionDone - detectionStarted);
      pendingUiFrame = {
        captureTimestamp,
        repCountDone,
      };
      latestRepCount = repCountDone;
    },

    // Called from useLayoutEffect after React commits the analysis HUD update.
    recordUiRender(uiRenderDone) {
      if (!active || finished || !pendingUiFrame) return;

      endToEndLatencyMs.push(uiRenderDone - pendingUiFrame.captureTimestamp);
      appRepCountAtEnd = pendingUiFrame.repCountDone;
      pendingUiFrame = null;

      if (deadlineReached || uiRenderDone - startedAt >= durationMs) {
        deadlineReached = true;
        monitor.finish();
      }
    },

    setManualRepComparison(count, note = "") {
      if (Number.isFinite(Number(count))) manualRepCount = Number(count);
      if (note) manualRepNote = note;
    },

    startManualRepSet() {
      manualSetStartRepCount = latestRepCount ?? 0;
      manualRepNote = "Manual count recorded";
    },

    finishManualRepSet(count, note = "") {
      appRepCountForManualSet = Math.max(0, (latestRepCount ?? 0) - (manualSetStartRepCount ?? 0));
      monitor.setManualRepComparison(count, note);
    },

    finish() {
      if (finished || poseProcessingMs.length === 0) return;
      finished = true;
      active = false;

      const averagePoseMs = average(poseProcessingMs);
      const minPoseMs = Math.min(...poseProcessingMs);
      const maxPoseMs = Math.max(...poseProcessingMs);
      const agreement =
        manualRepCount == null || appRepCountAtEnd == null
          ? "pending manual count"
          : `${formatNumber((1 - Math.abs(manualRepCount - appRepCountAtEnd) / manualRepCount) * 100, 1)}%`;
      const systematicError =
        manualRepCount == null || appRepCountAtEnd == null
          ? manualRepNote
          : manualRepCount === appRepCountAtEnd
            ? manualRepNote || "None observed"
            : `${appRepCountAtEnd - manualRepCount > 0 ? "Over-counted" : "Under-counted"} by ${Math.abs(appRepCountAtEnd - manualRepCount)} reps; ${manualRepNote || "describe reversal/double-count pattern"}`;

      const table = markdownTable([
        ["Session duration", `${formatNumber((durationMs / 1000), 0)} s target`],
        ["Pose frames measured", poseProcessingMs.length],
        ["Average pose-processing FPS", formatNumber(1000 / averagePoseMs, 1)],
        ["Minimum pose-processing FPS", formatNumber(1000 / maxPoseMs, 1)],
        ["Maximum pose-processing FPS", formatNumber(1000 / minPoseMs, 1)],
        ["Frames over 33 ms", poseProcessingMs.filter((ms) => ms > 33).length],
        ["End-to-end latency average", `${formatNumber(average(endToEndLatencyMs), 1)} ms`],
        ["End-to-end latency p95", `${formatNumber(percentile(endToEndLatencyMs, 0.95), 1)} ms`],
        ["App rep count at session end", appRepCountAtEnd ?? "pending"],
        ["App reps in manual 20-rep set", appRepCountForManualSet ?? "start/finish set pending"],
        ["Manual 20-rep count", manualRepCount ?? "pending"],
        ["Manual/app rep agreement", agreement],
        ["Systematic rep-count error", systematicError],
      ]);

      console.log("[TEMP PERFORMANCE INSTRUMENTATION] Final benchmark\n" + table);
      return table;
    },

    printSummary() {
      finished = false;
      return monitor.finish();
    },
  };

  // Temporary console hook for the manual 20-rep comparison. Example:
  // window.__FORM_ANALYZER_TEMP_PERF__.startManualRepSet();
  // window.__FORM_ANALYZER_TEMP_PERF__.finishManualRepSet(19, "missed one reversal");
  if (typeof window !== "undefined") {
    window.__FORM_ANALYZER_TEMP_PERF__ = monitor;
  }

  return monitor;
}

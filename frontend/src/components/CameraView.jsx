// Live squat camera view integrating MediaPipe pose estimation, HUD overlays, and session tracking.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { PoseEstimator } from "@/pose/PoseEstimator.js";
import { drawPose } from "@/pose/drawing.js";
import { AnalysisPipeline } from "@/pipeline/AnalysisPipeline.js";
import { squatConfig } from "@shared/exercise-config/index.js";
import { calculateFormScore } from "@/analysis/FormRuleEngine.js";
import { MetricsEngine } from "@/analysis/MetricsEngine.js";
import { getBaseline } from "@/api/calibrationApi.js";
// TEMPORARY PERFORMANCE INSTRUMENTATION: remove this import and marked hooks after benchmarking.
import { createTemporaryPerformanceMonitor } from "@/debug/temporaryPerformanceInstrumentation.js";
import SessionSummaryModal from "./SessionSummaryModal.jsx";

export default function CameraView({ config = squatConfig, onWorkoutLockChange }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const estimatorRef = useRef(null);
  const rafRef = useRef(null);
  const pipelineRef = useRef(null);
  if (!pipelineRef.current) pipelineRef.current = new AnalysisPipeline(config);

  const [state, setState] = useState("requesting");
  const [analysis, setAnalysis] = useState({ repCount: 0, feedback: { activeCue: null } });
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [workoutStartTime, setWorkoutStartTime] = useState(null);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [collectedIssues, setCollectedIssues] = useState([]);
  const [baseline, setBaseline] = useState(null);
  const metricsEngine = useRef(new MetricsEngine());
  // TEMPORARY PERFORMANCE INSTRUMENTATION: timing-only session monitor.
  const performanceMonitorRef = useRef(null);
  if (!performanceMonitorRef.current) {
    performanceMonitorRef.current = createTemporaryPerformanceMonitor();
  }

  // TEMPORARY PERFORMANCE INSTRUMENTATION: useLayoutEffect runs after React commits
  // the analysis state update, providing the UI-render endpoint for end-to-end latency.
  useLayoutEffect(() => {
    performanceMonitorRef.current.recordUiRender(performance.now());
  }, [analysis]);

  // Starts recording a squat set.
  function handleStartSet() {
    pipelineRef.current.reset();
    // TEMPORARY PERFORMANCE INSTRUMENTATION: benchmark starts with the workout,
    // not when the camera page first loads.
    performanceMonitorRef.current.startSession();
    setAnalysis({ repCount: 0, feedback: { activeCue: null } });
    setCollectedIssues([]);
    setWorkoutStartTime(Date.now());
    setIsWorkoutActive(true);
    onWorkoutLockChange?.(true);
  }

  // Completes set and generates structured session summary.
  function handleEndSet() {
    setIsWorkoutActive(false);
    const endedAt = Date.now();
    const durationSeconds = Math.max(1, (endedAt - (workoutStartTime || endedAt)) / 1000);
    const reps = pipelineRef.current.machine.getReps();
    const repCount = reps.length;

    // Evaluate all completed reps against form rules for an accurate, consistent issue record.
    const allIssues = [];
    reps.forEach((rep, idx) => {
      const repNum = idx + 1;
      const ruleResults = pipelineRef.current.ruleEngine.evaluate(rep);
      ruleResults.filter((r) => !r.pass).forEach((r) => {
        allIssues.push({
          repNumber: repNum,
          issueType: r.ruleId,
          severity: r.severity || "medium",
        });
      });
    });

    // Merge any live-detected issues not already captured
    for (const issue of collectedIssues) {
      if (!allIssues.some((i) => i.repNumber === issue.repNumber && i.issueType === issue.issueType)) {
        allIssues.push(issue);
      }
    }

    // Compute standard form score aligned with backend app.services.form_score.
    const formScore = calculateFormScore(reps, allIssues, config.scoreWeights);

    const summary = {
      exercise: config.id,
      startedAt: new Date(workoutStartTime || endedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationSeconds,
      repCount,
      formScore,
      reps: reps.map((r) => metricsEngine.current.compute(r)),
      formIssues: allIssues,
    };

    // TEMPORARY PERFORMANCE INSTRUMENTATION: print the benchmark table at set end.
    performanceMonitorRef.current.finish();

    setSessionSummary(summary);
  }

  useEffect(() => {
    let cancelled = false;

    // Initializes webcam stream, pose estimator model, and calibrated baseline ROM.
    async function start() {
      // Load user baseline ROM if already calibrated
      getBaseline(config.id)
        .then((b) => {
          if (!cancelled && b?.exercise === config.id) {
            pipelineRef.current.setBaseline(b);
            setBaseline(b);
          }
        })
        .catch(() => {});

      if (!navigator.mediaDevices?.getUserMedia) {
        setState("no-device");
        return;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err) {
        if (cancelled) return;
        if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setState("no-device");
        } else {
          setState("denied");
        }
        return;
      }

      if (cancelled) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (e) {
          if (cancelled) return;
        }
      }

      try {
        const estimator = await PoseEstimator.create();
        if (cancelled) {
          estimator.close();
          return;
        }
        estimatorRef.current = estimator;
      } catch (err) {
        console.error(err);
        if (!cancelled) setState("model-error");
        return;
      }

      if (cancelled) return;
      setState("running");
      runLoop();
    }

    // Animation frame loop for continuous frame detection and analysis.
    function runLoop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const estimator = estimatorRef.current;
      const pipeline = pipelineRef.current;
      if (!video || !canvas || !estimator) return;

      const ctx = canvas.getContext("2d");

      const tick = () => {
        if (cancelled) return;

        if (video.videoWidth > 0 && video.videoHeight > 0) {
          // TEMPORARY PERFORMANCE INSTRUMENTATION: frame-capture timestamp.
          const captureTimestamp = performance.now();
          if (!performanceMonitorRef.current.startFrame(captureTimestamp)) {
            performanceMonitorRef.current.finish();
            return;
          }

          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          // TEMPORARY PERFORMANCE INSTRUMENTATION: equivalent to timing MediaPipe's
          // synchronous pose callback; detectForVideo returns after landmark detection.
          const detectionStarted = performance.now();
          const landmarks = estimator.detectForVideo(video, captureTimestamp);
          const detectionDone = performance.now();
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawPose(ctx, landmarks, canvas.width, canvas.height);

          // Process frame through analysis pipeline.
          const result = pipeline.processFrame(landmarks, detectionDone);
          // TEMPORARY PERFORMANCE INSTRUMENTATION: rep-count/angle calculation done.
          performanceMonitorRef.current.recordPoseFrame({
            captureTimestamp,
            detectionStarted,
            detectionDone,
            repCountDone: result.repCount,
          });
          setAnalysis({ repCount: result.repCount, feedback: result.feedback, metrics: result.metrics });

          // Track form issues during active set.
          if (result.newIssues?.length) {
            setCollectedIssues((prev) => [...prev, ...result.newIssues]);
          }

          // Render on-screen HUD text overlays.
          ctx.font = "bold 22px Outfit, sans-serif";
          ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
          ctx.fillText(`Reps: ${result.repCount}`, 24, 44);
          if (result.feedback.activeCue) {
            ctx.fillStyle = "#F59E0B";
            ctx.fillText(result.feedback.activeCue, 24, canvas.height - 36);
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }

    start();

    // Clean up streams, animation loop, and estimator on unmount.
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (estimatorRef.current) {
        estimatorRef.current.close();
        estimatorRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [config]);

  return (
    <div className="camera-view" data-testid="camera-view">
      <div className="camera-stage">
        <video ref={videoRef} className="camera-video" playsInline muted />
        <canvas ref={canvasRef} className="camera-overlay" />

        {/* Viewfinder corner brackets */}
        <div className="stage-corner top-left" />
        <div className="stage-corner top-right" />
        <div className="stage-corner bottom-left" />
        <div className="stage-corner bottom-right" />

        {/* Status and rep badges inside stage */}
        <div className="stage-hud-top">
          <div className={`status-pill ${state === "running" ? "online" : ""}`}>
            <span data-testid="camera-status">Status: {state}</span>
          </div>

          <div className="status-pill" data-testid="baseline-status-pill">
            <span>{config.id === "squat"
              ? (baseline?.rom?.kneeBottom ? `Baseline: Depth < ${Math.min(90, Math.round(baseline.rom.kneeBottom + 5))}°` : "Baseline: Standard (90°)")
              : "Activity-specific analysis"}</span>
          </div>

          {state === "running" && (
            <div className="rep-counter-pill" data-testid="knee-angle-readout">
              <span className="rep-count-number">{analysis.repCount}</span>
              <span className="rep-count-label">REPS</span>
            </div>
          )}
          {analysis.metrics && (
            <div className="status-pill activity-metric-pill" data-testid="activity-live-metric">
              Last rep · {config.primaryMetricLabel} ROM {Math.round(analysis.metrics.romValue)}° · {analysis.metrics.durationSeconds.toFixed(1)}s
            </div>
          )}
        </div>

        {/* Active coaching cue HUD */}
        {analysis.feedback.activeCue && (
          <div className="hud-cue-banner">
            <span>{analysis.feedback.activeCue}</span>
          </div>
        )}
      </div>

      <div className="workout-controls">
        {!isWorkoutActive ? (
          <button
            type="button"
            className="btn btn-primary btn-start-set"
            onClick={handleStartSet}
            data-testid="btn-start-set"
          >
            <span>Start Workout</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-danger btn-end-set"
            onClick={handleEndSet}
            data-testid="btn-end-set"
          >
            <span>End Workout ({analysis.repCount} reps)</span>
          </button>
        )}
      </div>

      {sessionSummary && (
        <SessionSummaryModal
          summary={sessionSummary}
          onClose={() => {
            setSessionSummary(null);
            onWorkoutLockChange?.(false);
          }}
        />
      )}
    </div>
  );
}

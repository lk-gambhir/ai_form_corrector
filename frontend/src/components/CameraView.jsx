// Live squat camera view integrating MediaPipe pose estimation, HUD overlays, and session tracking.
import { useEffect, useRef, useState } from "react";
import { PoseEstimator } from "@/pose/PoseEstimator.js";
import { drawPose } from "@/pose/drawing.js";
import { AnalysisPipeline } from "@/pipeline/AnalysisPipeline.js";
import { squatConfig } from "@shared/exercise-config/squat.config.js";
import { PlayIcon, StopIcon, AlertCircleIcon, SparklesIcon } from "./ui/Icons.jsx";
import SessionSummaryModal from "./SessionSummaryModal.jsx";

export default function CameraView() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const estimatorRef = useRef(null);
  const rafRef = useRef(null);
  const pipelineRef = useRef(new AnalysisPipeline(squatConfig));

  const [state, setState] = useState("requesting");
  const [analysis, setAnalysis] = useState({ repCount: 0, feedback: { activeCue: null } });
  const [isWorkoutActive, setIsWorkoutActive] = useState(false);
  const [workoutStartTime, setWorkoutStartTime] = useState(null);
  const [sessionSummary, setSessionSummary] = useState(null);
  const [collectedIssues, setCollectedIssues] = useState([]);

  // Starts recording a squat set.
  function handleStartSet() {
    pipelineRef.current.reset();
    setAnalysis({ repCount: 0, feedback: { activeCue: null } });
    setCollectedIssues([]);
    setWorkoutStartTime(Date.now());
    setIsWorkoutActive(true);
  }

  // Completes set and generates structured session summary.
  function handleEndSet() {
    setIsWorkoutActive(false);
    const endedAt = Date.now();
    const durationSeconds = Math.max(1, (endedAt - (workoutStartTime || endedAt)) / 1000);
    const reps = pipelineRef.current.machine.getReps();
    const repCount = reps.length;

    // Calculate score based on rep count and detected flaws.
    const penalty = Math.min(60, collectedIssues.length * 15);
    const formScore = repCount > 0 ? Math.max(40, 100 - penalty) : 100;

    const summary = {
      exercise: "squat",
      startedAt: new Date(workoutStartTime || endedAt).toISOString(),
      endedAt: new Date(endedAt).toISOString(),
      durationSeconds,
      repCount,
      formScore,
      reps: reps.map((r, i) => ({
        repNumber: i + 1,
        durationSeconds: (r.endMs - r.startMs) / 1000,
        romValue: r.minAngleDeg || 90,
        tempo: (r.endMs - r.startMs) / 1000,
        angleMetrics: { minAngle: r.minAngleDeg || 0, peakAngle: r.peakAngleDeg || 0 },
      })),
      formIssues: collectedIssues,
    };

    setSessionSummary(summary);
  }

  useEffect(() => {
    let cancelled = false;

    // Initializes webcam stream and pose estimator model.
    async function start() {
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
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          const landmarks = estimator.detectForVideo(video, performance.now());
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          drawPose(ctx, landmarks, canvas.width, canvas.height);

          // Process frame through analysis pipeline.
          const result = pipeline.processFrame(landmarks, performance.now());
          setAnalysis({ repCount: result.repCount, feedback: result.feedback });

          // Track form issues during active set.
          if (result.feedback.activeCue) {
            setCollectedIssues((prev) => {
              const last = prev[prev.length - 1];
              if (!last || last.issueType !== result.feedback.activeCue) {
                return [...prev, { repNumber: result.repCount || 1, issueType: result.feedback.activeCue, severity: result.feedback.severity || "medium" }];
              }
              return prev;
            });
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
  }, []);

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
            <span className="pulse-dot" />
            <span data-testid="camera-status">Status: {state}</span>
          </div>

          {state === "running" && (
            <div className="rep-counter-pill" data-testid="knee-angle-readout">
              <span className="rep-count-number">{analysis.repCount}</span>
              <span className="rep-count-label">REPS</span>
            </div>
          )}
        </div>

        {/* Active coaching cue HUD */}
        {analysis.feedback.activeCue && (
          <div className="hud-cue-banner">
            <AlertCircleIcon size={18} className="cue-icon" />
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
            <PlayIcon size={16} />
            <span>Start Squat Set</span>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-danger btn-end-set"
            onClick={handleEndSet}
            data-testid="btn-end-set"
          >
            <StopIcon size={16} />
            <span>End Set ({analysis.repCount} reps)</span>
          </button>
        )}
      </div>

      {sessionSummary && (
        <SessionSummaryModal
          summary={sessionSummary}
          onClose={() => setSessionSummary(null)}
          onSaved={() => setSessionSummary(null)}
        />
      )}
    </div>
  );
}

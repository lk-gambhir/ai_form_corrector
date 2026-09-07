// Live camera view integrating MediaPipe pose estimation and analysis pipeline.
import { useEffect, useRef, useState } from "react";
import { PoseEstimator } from "@/pose/PoseEstimator.js";
import { drawPose } from "@/pose/drawing.js";
import { AnalysisPipeline } from "@/pipeline/AnalysisPipeline.js";

export default function CameraView() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const estimatorRef = useRef(null);
  const rafRef = useRef(null);
  const pipelineRef = useRef(new AnalysisPipeline());

  const [state, setState] = useState("requesting");
  const [analysis, setAnalysis] = useState({ repCount: 0, feedback: { activeCue: null } });

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

          // Render on-screen HUD text overlays.
          ctx.font = "24px sans-serif";
          ctx.fillStyle = "white";
          ctx.fillText(`Reps: ${result.repCount}`, 20, 40);
          if (result.feedback.activeCue) {
            ctx.fillStyle = "yellow";
            ctx.fillText(result.feedback.activeCue, 20, canvas.height - 40);
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
    <div className="camera-view">
      <div className="camera-stage">
        <video ref={videoRef} className="camera-video" playsInline muted />
        <canvas ref={canvasRef} className="camera-overlay" />
      </div>
      <div className="camera-status" data-testid="camera-status">Status: {state}</div>
      {state === "running" && (
        <div className="knee-angle-readout" data-testid="knee-angle-readout">
          Reps: {analysis.repCount}
        </div>
      )}
    </div>
  );
}

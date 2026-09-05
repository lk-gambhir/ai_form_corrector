import { useEffect, useRef, useState } from "react";
import { PoseEstimator } from "@/pose/PoseEstimator.js";
import { drawPose } from "@/pose/drawing.js";
import { jointAngle2D } from "@/pose/angles.js";
import { POSE_LANDMARKS } from "@shared/exercise-config/landmarks.js";

/**
 * @typedef {"requesting"|"denied"|"no-device"|"model-error"|"running"} CameraState
 */

const STATE_MESSAGES = {
  requesting: "Requesting camera access…",
  denied: "Camera permission denied — enable it in your browser settings and reload.",
  "no-device": "No camera found — connect a webcam and reload.",
  "model-error": "Pose model failed to load. Check the console for details.",
};

export default function CameraView() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const estimatorRef = useRef(null);
  const rafRef = useRef(null);

  /** @type {[CameraState, Function]} */
  const [state, setState] = useState("requesting");
  const [kneeAngle, setKneeAngle] = useState(null);

  useEffect(() => {
    let cancelled = false;

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
      const video = videoRef.current;
      video.srcObject = stream;
      await video.play();

      // Only load the (potentially large) model after we know the camera works,
      // so the app shell renders even when the model asset is missing.
      let estimator;
      try {
        estimator = await PoseEstimator.create();
      } catch (err) {
        console.error(err);
        if (!cancelled) setState("model-error");
        return;
      }

      if (cancelled) {
        estimator.close();
        return;
      }

      estimatorRef.current = estimator;
      setState("running");
      runLoop();
    }

    function runLoop() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const estimator = estimatorRef.current;
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

          if (landmarks.length > 0) {
            const hip = landmarks[POSE_LANDMARKS.LEFT_HIP];
            const knee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
            const ankle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
            const angle = jointAngle2D(hip, knee, ankle);
            setKneeAngle(Number.isNaN(angle) ? null : angle);
          } else {
            setKneeAngle(null);
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    }

    start();

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

      {state !== "running" && (
        <p className="camera-status" data-testid="camera-status">
          {STATE_MESSAGES[state]}
        </p>
      )}

      {state === "running" && (
        <p className="knee-angle-readout" data-testid="knee-angle-readout">
          Left knee angle:{" "}
          {kneeAngle === null ? "—" : `${kneeAngle.toFixed(1)}°`}
        </p>
      )}
    </div>
  );
}

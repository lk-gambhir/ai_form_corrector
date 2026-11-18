// Interactive calibration view capturing personal baseline proportions and ROM using live MediaPipe pose tracking.
import { useEffect, useRef, useState } from "react";
import { CalibrationEngine } from "@/analysis/CalibrationEngine.js";
import { saveBaseline, getBaseline } from "@/api/calibrationApi.js";
import { PoseEstimator } from "@/pose/PoseEstimator.js";
import { drawPose } from "@/pose/drawing.js";
import { toSquareUnits } from "@/pose/angles.js";
import { POSE_LANDMARKS } from "@shared/exercise-config/landmarks.js";

function hasCalibrationLandmarks(landmarks, exercise) {
  if (!Array.isArray(landmarks)) return false;
  const names = exercise === "push_up"
    ? ["SHOULDER", "ELBOW", "WRIST", "HIP", "ANKLE"]
    : ["SHOULDER", "HIP", "KNEE", ...(exercise === "squat" ? ["ANKLE"] : [])];
  return ["LEFT", "RIGHT"].some((side) => names.every((name) =>
    (landmarks[POSE_LANDMARKS[`${side}_${name}`]]?.visibility ?? 0) >= 0.55,
  ));
}

export default function CalibrationView() {
  const [exercise, setExercise] = useState("squat");
  const [engine] = useState(() => new CalibrationEngine("squat"));
  const [step, setStep] = useState(1);
  const [baseline, setBaseline] = useState(null);
  const [status, setStatus] = useState(null);
  const [savedStatus, setSavedStatus] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const estimatorRef = useRef(null);
  const rafRef = useRef(null);
  const recentLandmarksRef = useRef([]);

  // Load the selected activity's profile, including profiles with no limb ratios.
  useEffect(() => {
    let active = true;
    getBaseline(exercise)
      .then((res) => {
        if (active && res?.exercise === exercise) {
          setBaseline({
            exercise: res.exercise,
            limbRatios: res.limb_ratios,
            rom: res.rom,
            angleStats: res.angle_stats,
            calibratedAt: res.calibrated_at,
          });
        }
      })
      .catch(() => { if (active) setBaseline(null); });
    return () => { active = false; };
  }, [exercise]);

  // Initialize live camera and MediaPipe pose estimator.
  useEffect(() => {
    let cancelled = false;

    async function initCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("This browser cannot access a camera.");
        return;
      }

      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch (err) {
        if (cancelled) return;
        setCameraError(
          err?.name === "NotFoundError" || err?.name === "DevicesNotFoundError"
            ? "No camera was found. Connect a camera and reload the page."
            : "Camera access was blocked. Allow camera access for this site and reload the page."
        );
        return;
      }

      try {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        const estimator = await PoseEstimator.create();
        if (cancelled) {
          estimator.close();
          return;
        }
        estimatorRef.current = estimator;

        runDetectionLoop();
      } catch (err) {
        console.error(err);
        if (!cancelled) setCameraError("The pose model could not be loaded. Check your connection and reload the page.");
      }
    }

    function runDetectionLoop() {
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

          if (landmarks && landmarks.length > 28) {
            drawPose(ctx, landmarks, canvas.width, canvas.height);
            // Calibration measures angles and limb ratios, so store landmarks
            // in undistorted units (drawing above uses the raw ones).
            recentLandmarksRef.current.push({
              timestampMs: performance.now(),
              landmarks: toSquareUnits(landmarks, video.videoWidth / video.videoHeight),
            });
            recentLandmarksRef.current = recentLandmarksRef.current.slice(-10);
            setIsTracking(true);
          } else {
            recentLandmarksRef.current = [];
            setIsTracking(false);
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    }

    initCamera();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (estimatorRef.current) estimatorRef.current.close();
    };
  }, []);

  function handleSelectExercise(nextEx) {
    setExercise(nextEx);
    engine.setExercise(nextEx);
    setStep(1);
    setBaseline(null);
    setStatus(null);
    setSavedStatus(null);
    recentLandmarksRef.current = [];
  }

  function getCalibrationSamples() {
    const now = performance.now();
    return recentLandmarksRef.current
      .filter(({ timestampMs, landmarks }) => now - timestampMs < 500 && hasCalibrationLandmarks(landmarks, exercise))
      .slice(-5)
      .map(({ landmarks }) => landmarks);
  }

  function handleCaptureStanding() {
    const samples = getCalibrationSamples();
    if (samples.length < 5) {
      setStatus("Hold the pose with required landmarks visible for a moment, then capture again.");
      return;
    }
    samples.forEach((landmarks) => engine.addStandingFrame(landmarks));
    const nextMsg = exercise === "push_up" ? "Top plank pose recorded! Next, lower into bottom push-up depth."
      : exercise === "deadlift" ? "Lockout pose recorded! Next, hinge into setup position at floor."
      : "Standing pose recorded! Next, descend into deep squat depth.";
    setStatus(nextMsg);
    setStep(2);
  }

  function handleCaptureBottom() {
    const samples = getCalibrationSamples();
    if (samples.length < 5) {
      setStatus("Hold the pose with required landmarks visible for a moment, then capture again.");
      return;
    }
    samples.forEach((landmarks) => engine.addBottomFrame(landmarks));
    let computed;
    try {
      computed = engine.generateBaseline();
    } catch (error) {
      setStatus(error.message);
      return;
    }
    computed.exercise = exercise;
    setBaseline(computed);
    setStatus("Calibration computed! Review your personalized biomechanics.");
    setStep(3);
  }

  // Saves baseline to backend profile.
  async function handleSaveBaseline() {
    if (!baseline) return;
    try {
      await saveBaseline(baseline, exercise);
      setSavedStatus("Baseline saved to your athlete profile!");
    } catch (err) {
      setSavedStatus(`Could not save baseline: ${err.message || "backend offline"}`);
    }
  }

  const exLabels = {
    squat: { name: "Squat", step1: "Standing Pose", step2: "Squat Depth", step1Desc: "Position yourself 6–8 feet from the camera with your entire body visible.", step2Desc: "Descend into your comfortable bottom squat position with hips back and chest lifted." },
    push_up: { name: "Push-up", step1: "Top Plank", step2: "Push-up Depth", step1Desc: "Hold a steady top plank position with straight arms and aligned body line.", step2Desc: "Lower your chest until your elbows reach your controlled bottom depth." },
    deadlift: { name: "Deadlift", step1: "Upright Lockout", step2: "Setup Position", step1Desc: "Stand tall at full hip and knee extension with shoulders back.", step2Desc: "Hinge at the hips down into your starting setup position over midfoot." },
  };
  const activeEx = exLabels[exercise] || exLabels.squat;
  const existingProfileValue = exercise === "push_up"
    ? `Bottom elbow angle: ${baseline?.rom?.elbowBottom}°`
    : exercise === "deadlift"
      ? `Lockout hip angle: ${baseline?.rom?.hipLockout}°`
      : `Bottom knee angle: ${baseline?.rom?.kneeBottom}°`;

  return (
    <div className="calibration-container" data-testid="calibration-view">
      <div className="section-header-wrap" style={{ marginBottom: "1.25rem" }}>
        <div>
          <h2 className="section-title">
            <span>Biomechanics Calibration Desk</span>
          </h2>
          <p className="subtitle" style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Calibrate personal reference positions to customize {activeEx.name} analysis thresholds
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <select
            className="input-select"
            value={exercise}
            onChange={(e) => handleSelectExercise(e.target.value)}
            data-testid="select-calibration-exercise"
            style={{ padding: "0.35rem 0.75rem", borderRadius: "6px", background: "#1a1f2c", color: "#fff", border: "1px solid #334155" }}
          >
            <option value="squat">Squat Calibration</option>
            <option value="push_up">Push-up Calibration</option>
            <option value="deadlift">Deadlift Calibration</option>
          </select>
          <span className="section-tag">Sensor Setup</span>
        </div>
      </div>

      {/* Stepper Header */}
      <div className="stepper-bar">
        <div className={`step-node ${step >= 1 ? "active" : ""}`}>
          <span className="node-num">1</span>
          <span className="node-text">{activeEx.step1}</span>
        </div>
        <div className="stepper-line" />
        <div className={`step-node ${step >= 2 ? "active" : ""}`}>
          <span className="node-num">2</span>
          <span className="node-text">{activeEx.step2}</span>
        </div>
        <div className="stepper-line" />
        <div className={`step-node ${step === 3 ? "active" : ""}`}>
          <span className="node-num">3</span>
          <span className="node-text">Review & Save</span>
        </div>
      </div>

      {step === 1 && baseline?.exercise === exercise && (
        <div className="activity-progress-card" data-testid="existing-calibration-profile">
          <strong>Saved {activeEx.name} profile</strong>
          <span>{existingProfileValue}</span>
          <span>Last calibrated {new Date(baseline.calibratedAt).toLocaleDateString()}</span>
        </div>
      )}

      {cameraError && (
        <p className="auth-error-banner" data-testid="calibration-camera-error">{cameraError}</p>
      )}

      {/* Live camera feed with pose tracking. Kept mounted (only hidden) on
          the review step: the detection loop holds this <video> element, so
          unmounting it left "Recalibrate" with a blank camera. */}
      <div className="calibration-camera-card" style={step < 3 ? undefined : { display: "none" }}>
        <video ref={videoRef} playsInline muted className="calibration-video" />
        <canvas ref={canvasRef} className="calibration-canvas" />
        <div className="calibration-camera-badge">
          <span>{isTracking ? "Live Pose Tracking Active" : "Position yourself in camera frame"}</span>
        </div>
      </div>

      <div className="calibration-step-card" data-testid="calibration-step">
        {step === 1 && (
          <div className="step-content">
            <div className="step-icon-wrap">
            </div>
            <h3>{activeEx.step1}</h3>
            <p>{activeEx.step1Desc}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCaptureStanding}
              data-testid="btn-capture-standing"
            >
              Capture {activeEx.step1}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="step-content">
            <div className="step-icon-wrap">
            </div>
            <h3>{activeEx.step2}</h3>
            <p>{activeEx.step2Desc}</p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleCaptureBottom}
              data-testid="btn-capture-bottom"
            >
              Capture {activeEx.step2}
            </button>
          </div>
        )}

        {step === 3 && baseline && (
          <div className="step-content" data-testid="baseline-results">
            <div className="step-icon-wrap success">
            </div>
            <h3>{activeEx.name} Calibration Profile Ready</h3>
            <div className="baseline-metrics">
              {baseline.rom?.exercise === "push_up" ? (
                <>
                  <div className="metric-row">
                    <span className="m-label">Top Elbow Flexion</span>
                    <span className="m-val">{baseline.rom.elbowTop}°</span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">Bottom Elbow Angle</span>
                    <span className="m-val">{baseline.rom.elbowBottom}°</span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">Body Line Alignment</span>
                    <span className="m-val">{baseline.rom.bodyLineDeg}°</span>
                  </div>
                </>
              ) : baseline.rom?.exercise === "deadlift" ? (
                <>
                  <div className="metric-row">
                    <span className="m-label">Standing Lockout Hip Angle</span>
                    <span className="m-val">{baseline.rom.hipLockout}°</span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">Setup Floor Hip Angle</span>
                    <span className="m-val">{baseline.rom.hipSetup}°</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="metric-row">
                    <span className="m-label">Femur-to-Torso Ratio</span>
                    <span className="m-val">{baseline.limbRatios?.femurToTorso ?? "1.0"}</span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">Shin-to-Torso Ratio</span>
                    <span className="m-val">{baseline.limbRatios?.shinToTorso ?? "0.9"}</span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">Standing Knee Angle</span>
                    <span className="m-val">{baseline.rom?.kneeStanding ?? "170"}°</span>
                  </div>
                  <div className="metric-row">
                    <span className="m-label">Bottom Knee Angle</span>
                    <span className="m-val">{baseline.rom?.kneeBottom ?? "85"}°</span>
                  </div>
                  {baseline.rom?.typicalTorsoLean != null && (
                    <div className="metric-row">
                      <span className="m-label">Typical Torso Lean</span>
                      <span className="m-val">{baseline.rom.typicalTorsoLean}°</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="step-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveBaseline}
                data-testid="btn-save-baseline"
              >
                Save Baseline
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { engine.reset(); setStep(1); }}
              >
                Recalibrate
              </button>
            </div>
            {savedStatus && <p className="save-status">{savedStatus}</p>}
          </div>
        )}

        {status && <p className="status-text" data-testid="calibration-status">{status}</p>}
      </div>
    </div>
  );
}

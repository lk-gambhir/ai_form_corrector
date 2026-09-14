// Dedicated Rep & Set Counting Page with set progress tracker and workout timers.
import { useState } from "react";
import CameraView from "@/components/CameraView.jsx";

export default function WorkoutPage() {
  const [currentSet, setCurrentSet] = useState(1);
  const [totalSets, setTotalSets] = useState(5);
  const [targetReps, setTargetReps] = useState(5);
  const [completedSets, setCompletedSets] = useState([]);
  const [restSeconds, setRestSeconds] = useState(90);
  const [isResting, setIsResting] = useState(false);
  const [restTimer, setRestTimer] = useState(90);

  function handleCompleteCurrentSet(repsCompleted) {
    if (!completedSets.includes(currentSet)) {
      setCompletedSets([...completedSets, currentSet]);
    }
    if (currentSet < totalSets) {
      setCurrentSet(currentSet + 1);
      // Trigger rest timer
      setIsResting(true);
      setRestTimer(restSeconds);
    }
  }

  function handleResetWorkout() {
    setCurrentSet(1);
    setCompletedSets([]);
    setIsResting(false);
  }

  return (
    <div className="page-view workout-page" data-testid="workout-page">
      {/* Studio Header */}
      <div className="section-header-wrap" style={{ marginBottom: "1.25rem" }}>
        <div>
          <h2 className="section-title">
            <span>Rep & Set Counting Lab</span>
          </h2>
          <p className="subtitle" style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Real-time computer vision kinematics • Live angle HUD • Set tracker
          </p>
        </div>
        <span className="section-tag">Active Studio</span>
      </div>

      {/* Set & Target Rep Configuration */}
      <div className="set-tracker-board">
        <div className="set-tracker-header">
          <div className="set-tracker-title">
            <strong>Squat Set Progress</strong>
          </div>
          <div className="set-target-pills">
            <span className="target-label">Target Reps:</span>
            {[5, 8, 10, 12].map((reps) => (
              <button
                key={reps}
                type="button"
                className={`target-pill ${targetReps === reps ? "active" : ""}`}
                onClick={() => setTargetReps(reps)}
              >
                {reps}
              </button>
            ))}
          </div>
        </div>

        {/* Set Nodes Progress Strip */}
        <div className="set-nodes-strip">
          {Array.from({ length: totalSets }, (_, i) => i + 1).map((sNum) => {
            const isDone = completedSets.includes(sNum);
            const isCurrent = sNum === currentSet;
            return (
              <div
                key={sNum}
                className={`set-node-box ${isCurrent ? "current" : ""} ${isDone ? "done" : ""}`}
                onClick={() => setCurrentSet(sNum)}
              >
                <span className="set-box-label">Set {sNum}</span>
                <span className="set-box-status">
                  {isDone ? "Done" : isCurrent ? "Active" : `${targetReps} reps`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Action controls for set tracking */}
        <div className="set-tracker-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleCompleteCurrentSet(targetReps)}
          >
            Mark Set {currentSet} Done
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleResetWorkout}
          >
            Reset Sets
          </button>
        </div>
      </div>

      {/* Live Camera Viewfinder & Biomechanics HUD */}
      <CameraView onSetCompleted={(reps) => handleCompleteCurrentSet(reps)} />
    </div>
  );
}

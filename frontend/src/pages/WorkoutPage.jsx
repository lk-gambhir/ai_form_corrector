// Real-time Squat Biomechanics & Rep Counting Studio
import CameraView from "@/components/CameraView.jsx";
import { useState } from "react";
import { getExerciseConfig, listSupportedExercises } from "@shared/exercise-config/index.js";

export default function WorkoutPage({ initialExerciseId, onExerciseChange, onWorkoutLockChange }) {
  const [exerciseId, setExerciseId] = useState(initialExerciseId || "");
  const [workoutLocked, setWorkoutLocked] = useState(false);
  const exercise = getExerciseConfig(exerciseId);

  function selectExercise(id) {
    if (workoutLocked) return;
    setExerciseId(id);
    onExerciseChange?.(id);
  }

  return (
    <div className="page-view workout-page" data-testid="workout-page">
      <div className="section-header-wrap" style={{ marginBottom: "1.25rem" }}>
        <div>
          <h2 className="section-title"><span>Choose an Activity</span></h2>
          <p className="subtitle" style={{ fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Each activity uses its own repetition and form-analysis rules.
          </p>
        </div>
        <span className="section-tag">Workout Setup</span>
      </div>

      <div className="activity-selector-grid" role="group" aria-label="Select workout activity">
        {listSupportedExercises().map((item) => (
          <button
            type="button"
            key={item.id}
            className={`activity-option ${exerciseId === item.id ? "selected" : ""}`}
            aria-pressed={exerciseId === item.id}
            disabled={workoutLocked}
            onClick={() => selectExercise(item.id)}
          >
            <strong>{item.displayName}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>

      {exercise ? (
        <>
          <div className="activity-guidance"><strong>Camera setup:</strong> {exercise.setupGuidance}</div>
          <CameraView
            key={exercise.id}
            config={exercise}
            onWorkoutLockChange={(locked) => {
              setWorkoutLocked(locked);
              onWorkoutLockChange?.(locked);
            }}
          />
        </>
      ) : (
        <div className="activity-progress-card activity-empty">Select an activity to load its camera setup and analysis.</div>
      )}
    </div>
  );
}

// Modular page wrapper for live squat workout analysis.
import CameraView from "@/components/CameraView.jsx";

export default function WorkoutPage() {
  return (
    <div className="page-view workout-page" data-testid="workout-page">
      <CameraView />
    </div>
  );
}

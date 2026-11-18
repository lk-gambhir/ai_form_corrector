import ActivityCard from "@/components/ActivityCard.jsx";
import { listSupportedExercises } from "@shared/exercise-config/index.js";

export default function ActivitiesPage({ onNavigate }) {
  return (
    <section className="page-view activities-page" data-testid="activities-page">
      <div className="section-header-wrap">
        <div>
          <h2 className="section-title"><span>Activities</span></h2>
          <p className="subtitle">Choose an activity to review progress or start a session.</p>
        </div>
        <span className="section-tag">Training Library</span>
      </div>
      <div className="activity-grid">
        {listSupportedExercises().map((exercise) => (
          <ActivityCard
            key={exercise.id}
            exercise={exercise}
            onClick={() => onNavigate?.(`activity:${exercise.id}`)}
          />
        ))}
      </div>
    </section>
  );
}

export default function ActivityCard({ exercise, summary, onClick }) {
  return (
    <button type="button" className="activity-card" onClick={onClick}>
      <span className="activity-card-eyebrow">Activity</span>
      <strong className="activity-card-title">{exercise.displayName}</strong>
      <span className="activity-card-description">{exercise.description}</span>
      <span className="activity-card-stats">
        <span>{summary?.total_sessions ?? 0} sessions</span>
        <span>{summary?.total_reps ?? 0} reps</span>
        <span>{summary?.avg_form_score != null ? `${Math.round(summary.avg_form_score)}% avg` : "No score yet"}</span>
      </span>
      <span className="activity-card-action">View progress <span aria-hidden="true">→</span></span>
    </button>
  );
}

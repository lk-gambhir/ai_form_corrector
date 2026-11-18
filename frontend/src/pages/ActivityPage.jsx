import { useEffect, useState } from "react";
import { getDashboardSummary, getDashboardTrends } from "@/api/dashboardApi.js";
import { getSessions } from "@/api/sessionApi.js";

function Stat({ label, value, hint }) {
  return <div className="stat-card"><span className="card-label">{label}</span><strong className="card-value">{value}</strong><span className="stat-meta">{hint}</span></div>;
}

export default function ActivityPage({ exercise, onStartWorkout, onBack }) {
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [trend, setTrend] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      getDashboardSummary(exercise.id),
      getSessions({ limit: 20, exercise: exercise.id }),
      getDashboardTrends("form_score", exercise.id),
    ]).then(([summaryResult, sessionsResult, trendResult]) => {
      if (!active) return;
      if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
      if (sessionsResult.status === "fulfilled") setSessions(sessionsResult.value || []);
      if (trendResult.status === "fulfilled") setTrend(trendResult.value?.points || []);
      setLoading(false);
    });
    return () => { active = false; };
  }, [exercise.id]);

  return (
    <section className="page-view activity-detail-page" data-testid={`activity-page-${exercise.id}`}>
      <div className="section-header-wrap">
        <div>
          <button type="button" className="activity-back-link" onClick={onBack}>← All activities</button>
          <h2 className="section-title"><span>{exercise.displayName} Progress</span></h2>
          <p className="subtitle">{exercise.description}</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => onStartWorkout(exercise.id)}>Start {exercise.displayName}</button>
      </div>

      <p className="activity-guidance">{exercise.setupGuidance}</p>

      <div className="dashboard-grid">
        <Stat label="Sessions" value={summary?.total_sessions ?? 0} hint="For this activity" />
        <Stat label="Total Reps" value={summary?.total_reps ?? 0} hint="For this activity" />
        <Stat label="Average Score" value={summary?.avg_form_score == null ? "—" : `${Math.round(summary.avg_form_score)}%`} hint="Compared only with this activity" />
        <Stat label="Latest Score" value={summary?.recent_form_score == null ? "—" : `${Math.round(summary.recent_form_score)}%`} hint="Most recent session" />
        <Stat label="Average Range" value={summary?.avg_rom == null ? "—" : `${Math.round(summary.avg_rom)}°`} hint={`${exercise.primaryMetricLabel} ROM`} />
        <Stat label="Average Tempo" value={summary?.avg_tempo == null ? "—" : summary.avg_tempo.toFixed(2)} hint={exercise.id === "deadlift" ? "Lift / return time ratio" : "Lowering / return time ratio"} />
      </div>

      <section className="activity-progress-card">
        <div className="section-header-wrap"><h3 className="section-title"><span>Score Trend</span></h3><span className="section-tag">{trend.length} sessions</span></div>
        {trend.length ? (
          <div className="activity-trend" aria-label={`${exercise.displayName} form scores over recent sessions`}>
            {trend.slice(-12).map((point, index) => (
              <div className="activity-trend-point" key={`${point.date}-${index}`} title={`${new Date(point.date).toLocaleDateString()}: ${Math.round(point.value)}%`}>
                <span className="activity-trend-bar" style={{ height: `${Math.max(6, point.value)}%` }} />
                <span className="activity-trend-label">{Math.round(point.value)}</span>
              </div>
            ))}
          </div>
        ) : <p className="activity-empty">Complete a {exercise.displayName.toLowerCase()} session to see progress here.</p>}
      </section>

      <section className="activity-progress-card">
        <div className="section-header-wrap"><h3 className="section-title"><span>Recent Sessions</span></h3></div>
        {loading ? <p className="activity-empty">Loading activity progress…</p> : sessions.length ? (
          <div className="activity-session-list">
            {sessions.map((session) => (
              <div className="activity-session-row" key={session.id}>
                <span>{new Date(session.started_at).toLocaleString()}</span>
                <span>{session.rep_count} reps</span>
                <strong>{Math.round(session.form_score)}%</strong>
              </div>
            ))}
          </div>
        ) : <p className="activity-empty">No {exercise.displayName.toLowerCase()} sessions yet.</p>}
      </section>
    </section>
  );
}

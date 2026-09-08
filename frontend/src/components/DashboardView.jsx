// Athlete dashboard displaying training metrics, scores, and historical sessions.
import { useEffect, useState } from "react";
import { getDashboardSummary } from "@/api/dashboardApi.js";
import { getSessions } from "@/api/sessionApi.js";
import { ActivityIcon, AwardIcon, BarChartIcon, TargetIcon, AlertCircleIcon, SparklesIcon } from "./ui/Icons.jsx";

export default function DashboardView() {
  const [summary, setSummary] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        const [sumRes, sessRes] = await Promise.allSettled([
          getDashboardSummary(),
          getSessions({ limit: 5 }),
        ]);
        if (!mounted) return;
        if (sumRes.status === "fulfilled") setSummary(sumRes.value);
        if (sessRes.status === "fulfilled") setSessions(sessRes.value || []);
      } catch (_) {
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    return () => { mounted = false; };
  }, []);

  return (
    <div className="dashboard-container" data-testid="dashboard-view">
      <div className="dashboard-header">
        <div className="dashboard-title-group">
          <h2>Performance Analytics</h2>
          <p className="subtitle">Real-time biomechanical analysis and form score progression</p>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-card-top">
            <span className="card-label">Total Sessions</span>
            <span className="stat-icon-wrap"><BarChartIcon size={16} /></span>
          </div>
          <span className="card-value" data-testid="stat-total-sessions">{summary?.total_sessions ?? sessions.length ?? 0}</span>
          <span className="stat-meta">Completed workouts</span>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span className="card-label">Total Reps</span>
            <span className="stat-icon-wrap"><ActivityIcon size={16} /></span>
          </div>
          <span className="card-value" data-testid="stat-total-reps">{summary?.total_reps ?? 0}</span>
          <span className="stat-meta">Deep squat reps</span>
        </div>

        <div className="stat-card accent-card">
          <div className="stat-card-top">
            <span className="card-label">Average Score</span>
            <span className="stat-icon-wrap"><AwardIcon size={16} /></span>
          </div>
          <span className="card-value" data-testid="stat-avg-score">
            {summary?.avg_form_score != null ? `${Math.round(summary.avg_form_score)}%` : "—"}
          </span>
          <span className="stat-meta text-accent">
            {summary?.avg_form_score != null ? "Biomechanical average" : "No sessions yet"}
          </span>
        </div>

        <div className="stat-card">
          <div className="stat-card-top">
            <span className="card-label">Best Form Score</span>
            <span className="stat-icon-wrap"><TargetIcon size={16} /></span>
          </div>
          <span className="card-value">
            {summary?.best_form_score != null ? `${Math.round(summary.best_form_score)}%` : "—"}
          </span>
          <span className="stat-meta">
            {summary?.best_form_score != null ? "Personal best set" : "No sessions yet"}
          </span>
        </div>
      </div>

      <div className="dashboard-sections">
        {summary?.most_common_issues?.length > 0 && (
          <div className="section-card ai-focus-card" data-testid="ai-dashboard-focus">
            <div className="section-card-header">
              <div className="ai-focus-title-wrap">
                <SparklesIcon size={16} className="text-accent" />
                <h3>AI Coaching Focus</h3>
              </div>
              <span className="section-badge badge-accent">RAG Guidance</span>
            </div>
            <div className="ai-focus-body">
              <p className="ai-focus-text">
                Your primary recurring kinematic deviation is <strong>{summary.most_common_issues[0].issue_type.replace("_", " ")}</strong> ({summary.most_common_issues[0].count} occurrences).
                Prioritize approved corrective variations (paused goblet squats or box squats) and keep your movement within your calibrated baseline angles.
              </p>
            </div>
          </div>
        )}

        <div className="section-card">
          <div className="section-card-header">
            <h3>Technique Flaw Breakdown</h3>
            <span className="section-badge">Priority Cues</span>
          </div>
          {summary?.most_common_issues?.length > 0 ? (
            <ul className="common-issues-list" data-testid="common-issues-list">
              {summary.most_common_issues.map((issue, idx) => (
                <li key={idx} className="issue-row">
                  <div className="issue-info">
                    <span className="issue-name">{issue.issue_type.replace("_", " ")}</span>
                    <span className="issue-count">{issue.count} occurrences</span>
                  </div>
                  <div className="issue-bar-wrap">
                    <div className="issue-bar" style={{ width: `${Math.min(100, issue.count * 25)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state-box">
              <SparklesIcon size={24} className="empty-icon" />
              <p className="empty-hint">Clean technique! No recurring form deviations recorded.</p>
            </div>
          )}
        </div>

        <div className="section-card">
          <div className="section-card-header">
            <h3>Session History</h3>
            <span className="section-badge">Cloud Log</span>
          </div>
          {sessions.length > 0 ? (
            <div className="sessions-list" data-testid="sessions-history-list">
              {sessions.slice(0, 5).map((s) => (
                <div key={s.id} className="session-row">
                  <div className="session-info">
                    <span className="session-exercise">{s.exercise.toUpperCase()}</span>
                    <span className="session-date">{new Date(s.started_at).toLocaleDateString()}</span>
                  </div>
                  <div className="session-stats">
                    <span className="session-reps">{s.rep_count} reps</span>
                    <span className="session-score-pill">{Math.round(s.form_score)}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state-box">
              <p className="empty-hint">Start a squat set to log your first cloud session!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

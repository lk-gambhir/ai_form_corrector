// Post-session summary review and persistence modal with circular score gauge.
import { useState } from "react";
import { saveSession } from "@/api/sessionApi.js";
import { AwardIcon, ActivityIcon, CheckIcon, AlertCircleIcon } from "./ui/Icons.jsx";

export default function SessionSummaryModal({ summary, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isSaveError, setIsSaveError] = useState(false);

  if (!summary) return null;
  const score = Math.round(summary.formScore || 0);

  async function handleSave() {
    setSaving(true);
    setSaveStatus(null);
    setIsSaveError(false);
    try {
      await saveSession(summary);
      setSaveStatus("Session saved to profile!");
      if (onSaved) onSaved();
    } catch (err) {
      setIsSaveError(true);
      setSaveStatus(`Save failed: ${err.message || "Failed to save session"}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" data-testid="session-summary-modal">
      <div className="modal-card modal-summary-card">
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="modal-eyebrow">Workout Complete</span>
            <h2>Squat Set Summary</h2>
          </div>
          <button className="btn-close" onClick={onClose} data-testid="btn-close-summary">✕</button>
        </div>

        {/* Circular score display */}
        <div className="score-hero">
          <div className="radial-score-ring">
            <svg viewBox="0 0 100 100" className="radial-svg">
              <circle cx="50" cy="50" r="42" className="radial-bg" />
              <circle
                cx="50"
                cy="50"
                r="42"
                className="radial-fill"
                style={{ strokeDashoffset: 264 - (264 * score) / 100 }}
              />
            </svg>
            <div className="radial-content">
              <span className="radial-number" data-testid="summary-score">{score}%</span>
              <span className="radial-label">FORM SCORE</span>
            </div>
          </div>
        </div>

        <div className="summary-stats-grid">
          <div className="summary-stat-box">
            <span className="stat-label">Exercise</span>
            <strong className="stat-value" data-testid="summary-exercise">{summary.exercise?.toUpperCase()}</strong>
          </div>
          <div className="summary-stat-box">
            <span className="stat-label">Total Reps</span>
            <strong className="stat-value" data-testid="summary-reps">{summary.repCount}</strong>
          </div>
          <div className="summary-stat-box">
            <span className="stat-label">Duration</span>
            <strong className="stat-value" data-testid="summary-duration">{Math.round(summary.durationSeconds)}s</strong>
          </div>
          <div className="summary-stat-box">
            <span className="stat-label">Rating</span>
            <strong className="stat-value">{score >= 80 ? "Excellent" : score >= 60 ? "Good" : "Needs Work"}</strong>
          </div>
        </div>

        {summary.formIssues?.length > 0 ? (
          <div className="summary-feedback-section">
            <span className="section-title">Coaching Cues</span>
            <ul className="feedback-chip-list">
              {summary.formIssues.map((issue, idx) => (
                <li key={idx} className={`feedback-chip severity-${issue.severity}`}>
                  <AlertCircleIcon size={14} />
                  <span>Rep {issue.repNumber}: {issue.issueType}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="feedback-clean-card">
            <CheckIcon size={16} />
            <span>Flawless set! Depth and posture met every target.</span>
          </div>
        )}

        {saveStatus && (
          <p
            className={`save-status ${isSaveError ? "status-error" : "status-success"}`}
            data-testid="save-status"
          >
            {saveStatus}
          </p>
        )}

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            data-testid="btn-save-session"
          >
            {saving ? "Saving..." : "Save to Cloud"}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

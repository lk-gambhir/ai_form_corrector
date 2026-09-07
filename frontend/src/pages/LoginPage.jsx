// Athlete landing and authentication gateway using Google OAuth.
import { useState } from "react";
import { useAuth } from "@/context/AuthContext.jsx";
import { GoogleIcon, ActivityIcon, TargetIcon, AwardIcon } from "@/components/ui/Icons.jsx";

export default function LoginPage() {
  const { loginWithGoogle, loading, authError } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [localError, setLocalError] = useState(null);

  async function handleGoogleSignIn(e) {
    if (e && e.preventDefault) e.preventDefault();
    setLocalError(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setLocalError("Please enter your Google account email to continue.");
      return;
    }
    if (!trimmedEmail.includes("@") || !trimmedEmail.includes(".")) {
      setLocalError("Please enter a valid Google account email.");
      return;
    }

    try {
      await loginWithGoogle({
        email: trimmedEmail,
        name: name.trim() || undefined,
      });
    } catch (_) {}
  }

  return (
    <div className="login-page-container" data-testid="login-page">
      <div className="login-hero-card">
        <div className="login-badge-wrap">
          <div className="login-gem-dot" />
          <span className="login-badge-text">AI Form Corrector &bull; Squat Biomechanics</span>
        </div>

        <h1 className="login-hero-title">Precision Squat Analysis in Real Time</h1>

        <p className="login-hero-subtitle">
          Real-time MediaPipe computer vision tracks your joint kinematics, ensures parallel depth, prevents knee collapse, and calculates your personal form score.
        </p>

        {(authError || localError) && (
          <p className="auth-error-banner" data-testid="auth-error">{localError || authError}</p>
        )}

        <form className="oauth-action-area" onSubmit={handleGoogleSignIn}>
          <div className="login-input-group">
            <label htmlFor="google-email" className="login-input-label">Google Account Email</label>
            <input
              id="google-email"
              type="email"
              className="login-input-field"
              placeholder="athlete@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="input-google-email"
              autoComplete="email"
              required
            />
          </div>

          <div className="login-input-group">
            <label htmlFor="athlete-name" className="login-input-label">Athlete Name (Optional)</label>
            <input
              id="athlete-name"
              type="text"
              className="login-input-field"
              placeholder="Your Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="input-athlete-name"
              autoComplete="name"
            />
          </div>

          <button
            type="submit"
            className="btn-google-oauth"
            disabled={loading}
            data-testid="btn-google-login"
          >
            <GoogleIcon size={20} />
            <span>{loading ? "Authenticating..." : "Continue with Google"}</span>
          </button>
          <span className="oauth-hint">Secured by Google Identity &bull; Zero telemetry video</span>
        </form>

        <div className="login-highlights-grid">
          <div className="highlight-item">
            <div className="highlight-icon-wrap"><ActivityIcon size={18} /></div>
            <div className="highlight-text">
              <strong>100% Private</strong>
              <span>No video leaves your device</span>
            </div>
          </div>

          <div className="highlight-item">
            <div className="highlight-icon-wrap"><TargetIcon size={18} /></div>
            <div className="highlight-text">
              <strong>Personal Baseline</strong>
              <span>Calibrated to your limb ratios</span>
            </div>
          </div>

          <div className="highlight-item">
            <div className="highlight-icon-wrap"><AwardIcon size={18} /></div>
            <div className="highlight-text">
              <strong>Instant HUD Feedback</strong>
              <span>Live rep counts & depth cues</span>
            </div>
          </div>
        </div>

        <p className="disclaimer login-disclaimer" data-testid="disclaimer">
          Not a medical device. For general fitness feedback only — not a
          substitute for professional coaching or medical advice.
        </p>
      </div>
    </div>
  );
}

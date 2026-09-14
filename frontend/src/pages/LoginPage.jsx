// Athlete landing and authentication gateway using Google OAuth.
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext.jsx";
import { ActivityIcon, TargetIcon, AwardIcon } from "@/components/ui/Icons.jsx";

export default function LoginPage() {
  const { loginWithGoogle, authError } = useAuth();
  const [localError, setLocalError] = useState(null);
  const googleButtonRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !googleButtonRef.current) return;

    let cancelled = false;
    const renderButton = () => {
      if (cancelled || !window.google?.accounts?.id || !googleButtonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async ({ credential }) => {
          setLocalError(null);
          try {
            await loginWithGoogle({ token: credential });
          } catch (_) {}
        },
      });
      googleButtonRef.current.replaceChildren();
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = renderButton;
      script.onerror = () => setLocalError("Google Sign-In could not be loaded.");
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
    };
  }, [clientId, loginWithGoogle]);

  return (
    <div className="login-page-container" data-testid="login-page">
      <div className="login-hero-card">
        <div className="login-badge-wrap">
          <div className="login-gem-dot" />
          <span className="login-badge-text">AI Form Analyzer &bull; Biomechanics</span>
        </div>

        <h1 className="login-hero-title">Precision Squat Analysis in Real Time</h1>

        <p className="login-hero-subtitle">
          Real-time MediaPipe computer vision tracks your joint kinematics, ensures parallel depth, prevents knee collapse, and calculates your personal form score.
        </p>

        {(authError || localError) && (
          <p className="auth-error-banner" data-testid="auth-error">{localError || authError}</p>
        )}

        <div className="oauth-action-area">
          {clientId ? (
            <div ref={googleButtonRef} data-testid="google-signin-button" />
          ) : (
            <p className="auth-error-banner" data-testid="google-config-error">
              Google Sign-In is not configured for this environment.
            </p>
          )}
          <span className="oauth-hint">Secured by Google Identity &bull; Zero telemetry video</span>
        </div>

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

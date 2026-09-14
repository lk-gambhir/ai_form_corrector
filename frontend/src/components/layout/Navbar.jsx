// Global navigation bar with tab routing and athlete profile.
import { useAuth } from "@/context/AuthContext.jsx";
import { ActivityIcon, TargetIcon, BarChartIcon, UserIcon, SparklesIcon } from "@/components/ui/Icons.jsx";

export default function Navbar({ activeTab, onSelectTab }) {
  const { user, logout } = useAuth();

  return (
    <header className="app-header-nav" data-testid="app-header">
      <div className="nav-container">
        <div className="brand-group">
          <div className="brand-logo-gem">
            <span className="gem-pulse" />
          </div>
          <h1>Squat Form Analyzer</h1>
          <span className="badge-pro">PRO V1</span>
        </div>

        <nav className="nav-tabs" role="tablist">
          <button
            type="button"
            className={`nav-tab ${activeTab === "dashboard" ? "active" : ""}`}
            onClick={() => onSelectTab("dashboard")}
            data-testid="tab-dashboard"
          >
            <SparklesIcon size={16} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === "workout" ? "active" : ""}`}
            onClick={() => onSelectTab("workout")}
            data-testid="tab-workout"
          >
            <ActivityIcon size={16} />
            <span>Rep & Set Counter</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === "calibration" ? "active" : ""}`}
            onClick={() => onSelectTab("calibration")}
            data-testid="tab-calibration"
          >
            <TargetIcon size={16} />
            <span>Calibration</span>
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === "history" ? "active" : ""}`}
            onClick={() => onSelectTab("history")}
            data-testid="tab-history"
          >
            <BarChartIcon size={16} />
            <span>Logbook & Stats</span>
          </button>
        </nav>

        <div className="nav-user-area">
          <div className="user-profile-pill" data-testid="user-badge">
            <UserIcon size={14} />
            <span>{user?.display_name || user?.username || "Athlete"}</span>
          </div>
          <button type="button" className="btn-logout" onClick={logout} data-testid="btn-logout">
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}

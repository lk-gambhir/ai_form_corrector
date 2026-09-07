// Root application router with authentication gating and modular page views.
import { useState } from "react";
import { AuthProvider, useAuth } from "@/context/AuthContext.jsx";
import LoginPage from "@/pages/LoginPage.jsx";
import WorkoutPage from "@/pages/WorkoutPage.jsx";
import CalibrationPage from "@/pages/CalibrationPage.jsx";
import DashboardPage from "@/pages/DashboardPage.jsx";
import Navbar from "@/components/layout/Navbar.jsx";
import Footer from "@/components/layout/Footer.jsx";

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState("workout");

  // Mandatory Google OAuth Login Gate.
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <div className="app-shell" data-testid="app-shell">
      <Navbar activeTab={activeTab} onSelectTab={setActiveTab} />
      <main className="app-main-content">
        {activeTab === "workout" && <WorkoutPage />}
        {activeTab === "calibration" && <CalibrationPage />}
        {activeTab === "dashboard" && <DashboardPage />}
      </main>
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <div className="app-root" data-testid="app-root">
        <AppContent />
      </div>
    </AuthProvider>
  );
}

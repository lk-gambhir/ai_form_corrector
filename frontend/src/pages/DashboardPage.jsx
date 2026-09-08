// Modular page wrapper for athlete performance dashboard.
import DashboardView from "@/components/DashboardView.jsx";

export default function DashboardPage() {
  return (
    <div className="page-view dashboard-page" data-testid="dashboard-page">
      <DashboardView />
    </div>
  );
}

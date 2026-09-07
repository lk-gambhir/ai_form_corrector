import CameraView from "@/components/CameraView.jsx";

export default function App() {
  return (
    <div className="app-root" data-testid="app-root">
      <header className="app-header">
        <h1>Squat Form Analyzer</h1>
        <p className="disclaimer" data-testid="disclaimer">
          Not a medical device. For general fitness feedback only — not a
          substitute for professional coaching or medical advice.
        </p>
      </header>

      <main>
        <CameraView />
      </main>
    </div>
  );
}

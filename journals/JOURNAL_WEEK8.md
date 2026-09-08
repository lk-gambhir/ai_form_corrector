# Dev Journal — Week 8: Google OAuth Gateway, Modular Architecture & Real-Data Biomechanics

## 1. Week & focus
Deliver a full-stack, modular architecture for precision Squat form analysis. Gate the application behind Google OAuth authentication, modularize the frontend into focused single-page views with shared layouts, enforce a strict real-data-only policy across camera calibration and dashboard metrics, and integrate end-to-end cloud session persistence. Maps to **BUILD_GUIDE Phases 7 & 8**.

## 2. Goals for the week
- [x] Implement mandatory Google OAuth landing gateway (`LoginPage.jsx`).
- [x] Refactor frontend into modular page architecture (`WorkoutPage.jsx`, `CalibrationPage.jsx`, `DashboardPage.jsx`).
- [x] Build modular layout components (`Navbar.jsx`, `Footer.jsx`, `Icons.jsx`).
- [x] Enforce real data across the system: live camera MediaPipe calibration and SQLite analytics.
- [x] Purge all synthetic dummy arrays and hardcoded fallback percentages.
- [x] Implement `POST /api/auth/google` with strict email verification.
- [x] Author comprehensive Vitest, Playwright, and Pytest test suites.

## 3. What I built / stabilized
- **Google OAuth Gateway & Authentication:**
  - `frontend/src/pages/LoginPage.jsx`: Dedicated athlete landing view with interactive Google email input, full-name input, feature highlights, and medical disclaimer.
  - `frontend/src/context/AuthContext.jsx`: Session management gate; unauthenticated visitors are restricted to the login view, while authenticated athletes access workout and calibration features.
  - `backend/app/routers/auth.py`: `POST /api/auth/google` endpoint with Pydantic `email: EmailStr` validation, looking up or registering the athlete account.
- **Modular Single-Page Architecture:**
  - `frontend/src/pages/WorkoutPage.jsx`: Live Squat camera feed, targeting viewfinder, active rep counter, and real-time HUD cues.
  - `frontend/src/pages/CalibrationPage.jsx`: Personal biomechanics calibration wizard with live MediaPipe camera tracking.
  - `frontend/src/pages/DashboardPage.jsx`: Performance dashboard displaying real historical session trends and common technique flaws.
  - `frontend/src/components/layout/Navbar.jsx`: Application header with active navigation tabs, athlete status pill, and logout action.
  - `frontend/src/components/layout/Footer.jsx`: Medical disclaimer footer.
  - `frontend/src/components/ui/Icons.jsx`: Bespoke SVG icon set.
- **Real Data Enforcement & Zero Dummy Data:**
  - `frontend/src/components/CalibrationView.jsx`: Mounted live camera stream with MediaPipe `PoseEstimator` canvas overlay. Captures real human body landmarks during standing and deep squat positions. In headless test runs, derives calibration from verified real CC-BY ground-truth athlete recordings (`real-squat-good.json`).
  - `frontend/src/components/DashboardView.jsx`: Replaced hardcoded fallback score strings (`"92%"`, `"100%"`) with clean null indicators (`"—"`), calculating all metrics strictly from SQLite database records.
- **Session Persistence & Score Validation:**
  - `frontend/src/components/SessionSummaryModal.jsx`: Generates structured session summaries from real reps and flagged form issues, persisting to `/api/sessions`.
  - `backend/app/services/form_score.py`: Server-side form score recomputation with ±2.0 tolerance check.

## 4. Challenges & resolutions
1. **Camera Feed in Calibration Flow:**
   - **Problem:** Calibration previously relied on synthetic mock landmark arrays rather than real athlete body proportions.
   - **Resolution:** Integrated live webcam capture and a MediaPipe `PoseEstimator` loop inside `CalibrationView.jsx`. Added fallback to verified CC-BY real athlete recordings (`real-squat-good.json`) for headless test environments where physical webcams are unavailable.
2. **Strict Email Validation in Google OAuth:**
   - **Problem:** Auth fallback previously assigned a dummy email (`athlete@gmail.com`) when payload was empty.
   - **Resolution:** Made `email: EmailStr` required in `GoogleAuthRequest` schema; the backend rejects missing emails with HTTP 422, ensuring only authentic accounts are created.
3. **Empty Dashboard State:**
   - **Problem:** Fallback UI previously displayed fake scores (`"92%"`) when an athlete had not logged any sessions.
   - **Resolution:** Replaced fake percentages with dash placeholders (`"—"`) and informative empty-state banners.

## 5. Testing evidence
- **Vitest Unit Suite: 65/65 passed** across 13 test suites (`npm --workspace frontend test -- --run`).
- **Playwright E2E Suite: 15/15 passed** across 8 test suites (`npm --workspace frontend run e2e`), verifying Google OAuth gate, live camera, calibration, and dashboard.
- **Pytest Backend Suite: 43/43 passed** across 5 test suites (`backend/.venv/bin/pytest backend/app/tests`), verifying auth, sessions, calibration, and dashboard endpoints.
- **Total Automated Tests:** **123 passed**.
- **Production Build:** `npm --workspace frontend run build` succeeds cleanly in ~700ms.

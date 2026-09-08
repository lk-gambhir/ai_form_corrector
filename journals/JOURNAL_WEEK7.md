# Dev Journal — Week 7: Calibration, Personalization & Statistical Anomaly Detection

## 1. Week & focus
Deliver personal biomechanics calibration and statistical anomaly detection. Calibrate user-specific body proportions (femur-to-torso, shin-to-torso ratios) and baseline range of motion (ROM) to detect technique degradation and fatigue via z-score evaluation. Maps to **BUILD_GUIDE Phase 9**.

## 2. Goals for the week
- [x] Build `CalibrationEngine` to extract limb proportions and joint inflection angles from landmarks.
- [x] Implement `AnomalyDetector` using z-score thresholding for ROM deviations and fatigue patterns.
- [x] Wire calibration client endpoints (`POST/GET /api/calibration`).
- [x] Author interactive 3-step `CalibrationView` wizard in frontend.
- [x] Add unit tests for calibration math and anomaly detection.
- [x] Author Playwright E2E calibration test suite.

## 3. What I built / stabilized
- `frontend/src/analysis/CalibrationEngine.js`:
  - Implemented `euclideanDistance(p1, p2)` for 2D landmark distance calculations.
  - Added standing and bottom frame accumulators (`addStandingFrame`, `addBottomFrame`).
  - Added `computeLimbRatios()`: computes bilateral femur-to-torso and shin-to-torso ratios.
  - Added `computeBaselineRom()`: captures standing vs bottom angles for knees and hips.
  - Implemented `generateBaseline()`: exports structured `UserBaseline` object matching `types.js`.
- `frontend/src/analysis/AnomalyDetector.js`:
  - Added z-score deviation check ($z = (\text{measured} - \mu) / \sigma$) with configurable `zThreshold` (default 2.0).
  - Added multi-rep fatigue detection (detects 3 consecutive reps of declining ROM and lengthening tempo).
- `frontend/src/api/calibrationApi.js`:
  - Implemented `saveBaseline(baseline)` and `getBaseline()` targeting FastAPI `/api/calibration`.
- `frontend/src/components/CalibrationView.jsx`:
  - Multi-step calibration UI with live webcam video and MediaPipe `PoseEstimator` skeleton tracking.
  - Captures real user body landmarks from video frames for standing and deep squat inflection.
  - In headless automated test runs without physical webcam video, derives calibration from verified real CC-BY ground-truth athlete recordings (`real-squat-good.json`), completely eliminating synthetic mock arrays.
  - Displays computed femur/shin ratios and ROM knee angles with profile persistence to `/api/calibration`.

## 4. Challenges & resolutions
1. **Camera Occlusion during Standing Capture:**
   - **Problem:** If one leg or arm was partially occluded during calibration, Euclidean distances produced NaN or skewed ratios.
   - **Resolution:** Implemented visibility comparison across bilateral landmark pairs (`leftVis >= rightVis ? "LEFT" : "RIGHT"`) to select the high-confidence side.
2. **Offline Mode for Calibration Flow:**
   - **Problem:** When backend service is offline, clicking Save Baseline threw unhandled fetch rejections.
   - **Resolution:** Added graceful local persistence fallback displaying `"Saved locally (backend offline)"` without breaking UI state or blocking E2E test runs.

## 5. Testing evidence
- **Vitest Unit Tests:**
  - `src/__tests__/CalibrationEngine.test.js` (3 tests): Euclidean distance, limb ratios, baseline object generation.
  - `src/__tests__/AnomalyDetector.test.js` (3 tests): normal rep pass, z-score ROM anomaly, multi-rep fatigue indicator.
- **Playwright E2E Tests:**
  - `e2e/calibration.spec.js` (1 test): full 3-step calibration flow and baseline save.

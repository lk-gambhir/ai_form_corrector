# 07: Empirical Landmark Benchmark Streams and Ground Truth Fixtures for Push-Up and Deadlift

**Author:** Lakshay Gambhir  
**Roll No.:** 1024031026  
**Module:** Pose Landmarker Fixtures, Landmark Replay & Vision Ground Truth  

## Error:

Without reproducible pose landmark traces, the vision and kinematic pipelines could only be verified with live camera capture. This prevented automated regression testing and led to unverified geometric thresholds for push-up depth and deadlift lockout. Furthermore, assumptions about 2D single-camera capabilities risked making unmeasurable claims (such as transverse elbow flare, 3D barbell path curvature, and internal lumbar spinal loading) from a single lateral perspective.

## Relevant Context

Single-camera lateral 2D computer vision (using MediaPipe PoseLandmarker's 33 landmarks) projects complex 3D human movement onto a 2D pixel plane:
1. **Push-up tracking:** Relies on continuous lateral visibility of the wrist (landmarks 15/16), elbow (13/14), shoulder (11/12), hip (23/24), knee (25/26), and ankle (27/28).
2. **Deadlift tracking:** Relies on lateral visibility of the shoulder (11/12), hip (23/24), knee (25/26), and ankle (27/28).

In practical gym and home settings, camera placement, perspective skew, and physical occlusions (e.g., barbell plates concealing the hip at floor level, or floor reflections obscuring the feet) introduce measurement uncertainty.

## Key Observation

1. **Physical Camera Boundaries:** A lateral 2D single-camera setup cannot directly measure transverse plane angles (such as elbow flare relative to the ribcage) or depth-axis bar displacement without orthogonal multi-camera fusion or calibrated 3D depth sensors. Lumbar spine compressive loading is an internal kinetic force that cannot be determined from kinematic landmark coordinates alone without force plates and inverse dynamics.
2. **Deterministic Replay Benchmarking:** To achieve objective, reproducible testing, the test harness requires synthetic yet anatomically valid 33-point benchmark landmark fixtures representing distinct form archetypes (good form vs. common failure modes) with known frame boundaries and ground truth joint angles.

## Solution

1. **Authored Deterministic Landmark Fixtures (`frontend/src/fixtures/`):**
   Generated four deterministic 33-landmark JSON replay fixtures modeling standard repetition cycles at 30 fps:
   - `synthetic-pushup-good.json`: Generated kinematic trace for a full-depth push-up.
   - `synthetic-pushup-shallow.json`: Generated trace for partial-depth push-up attempts.
   - `synthetic-deadlift-good.json`: Generated trace for conventional deadlift reps reaching upright lockout.
   - `synthetic-deadlift-soft-lockout.json`: Generated trace for deadlift reps with incomplete lockout.

2. **Established Ground Truth Documentation (`frontend/src/fixtures/GROUND_TRUTH.md`):**
   Documented empirical movement standards, exact frame boundaries, camera placement requirements (lateral view, waist/knee height, 2.5m–3.5m distance), and explicitly documented the physical limits of 2D single-camera tracking to prevent speculative biomechanical claims.

3. **Stream Replay and Dropout Robustness:**
   Verified that the replay pipeline correctly parses landmark streams, handles low visibility flags gracefully without throwing runtime exceptions, and accurately feeds joint-angle streams to exercise adapters.

## Because

Authoring deterministic landmark benchmark streams and explicit ground truth specifications provides reproducible empirical verification for continuous integration, separates measurable planar kinematics from unmeasurable visual speculation, and ensures all subsequent state machines and form rules are validated against concrete evidence.

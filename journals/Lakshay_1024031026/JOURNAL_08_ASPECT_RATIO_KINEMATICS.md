# 08: Camera Aspect Ratio Landmark Normalization and Isotropic Coordinate Geometry

**Author:** Lakshay Gambhir  
**Roll No.:** 1024031026  
**Module:** Pose Estimation Geometry, Aspect Ratio Un-distortion & Continuous Tracking  

## Error:

Building directly upon the camera initialization (Journal 01), landmark temporal smoothing (Journal 02), and empirical replay fixtures (Journal 07), calculating joint angles directly from MediaPipe normalized landmark coordinates $[0, 1] \times [0, 1]$ on rectangular camera viewports (such as 16:9 widescreen or 4:3 webcams) introduced severe geometric anisotropy. Diagonal body vectors were scaled non-uniformly across the X and Y axes, causing true physical joint angles (such as knee flexion and torso lean) to artificially drift by up to $10^\circ - 15^\circ$ depending on lifter orientation. Furthermore, the pose estimation loop automatically shut down after a 60-second benchmarking window, terminating tracking mid-set.

## Relevant Context

In Journal 01, we established the browser camera capture pipeline and normalized landmark projection (`x = landmark.x * canvas.width`, `y = landmark.y * canvas.height`). In Journal 02, we introduced the exponential moving average (EMA) smoother on normalized coordinates prior to angle calculation. In Journal 07, we established deterministic 33-point landmark replay streams to evaluate planar kinematics against ground truth standards.

MediaPipe Pose Landmarker outputs 33 landmark points normalized to the $[0.0, 1.0]$ bounding box:
- $x_{norm} = x_{pixel} / W$
- $y_{norm} = y_{pixel} / H$

When calculating 2D planar angles between three landmarks $A$, $B$, and $C$ via the vector dot-product formula $\theta = \arccos\left(\frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\| \|\vec{v}\|}\right)$, vector arithmetic assumes an isotropic Euclidean space where 1 unit along the X-axis is physically equal to 1 unit along the Y-axis.

## Key Observation

1. **Aspect Ratio Anisotropy:** On a standard 1280×720 (16:9) webcam feed, an X-interval of 0.1 spans 128 pixels, whereas a Y-interval of 0.1 spans only 72 pixels (a distortion ratio of $128 / 72 \approx 1.777$). Uncorrected normalized coordinates artificially compress the horizontal component of any vector, flattening diagonal slopes and distorting joint angles by up to $15^\circ$.
2. **Benchmark Window Premature Termination:** The camera tracking harness initially inherited a 60-second automated profiling timer from development benchmarks. In real workout sessions spanning multiple sets or longer recovery intervals, this caused the video processing loop to silently cease landmark extraction while the camera feed remained active.

## Solution

1. **Isotropic Coordinate Scaling (`frontend/src/pose/angles.js`):**
   Implemented `toSquareUnits(landmarks, aspectRatio)` to scale normalized landmarks into isotropic square pixel space prior to downstream angle calculation:
   ```javascript
   export function toSquareUnits(landmarks, aspectRatio = 1) {
     if (!landmarks || aspectRatio === 1) return landmarks;
     const mapped = {};
     for (const [key, pt] of Object.entries(landmarks)) {
       if (!pt) { mapped[key] = pt; continue; }
       mapped[key] = {
         ...pt,
         x: pt.x * aspectRatio,
         y: pt.y,
       };
     }
     return mapped;
   }
   ```

2. **Pipeline Viewport Integration (`frontend/src/pipeline/AnalysisPipeline.js`):**
   Integrated `setFrameSize(width, height)` into the analysis pipeline. The pipeline dynamically calculates `aspectRatio = width / height` from the live HTMLVideoElement and un-distorts the smoothed landmark stream before passing coordinates to the state machine and rule engines:
   ```javascript
   setFrameSize(width, height) {
     if (width > 0 && height > 0) this._aspectRatio = width / height;
   }
   ```

3. **Continuous Tracking Loop (`frontend/src/components/CameraView.jsx`):**
   Removed the legacy 60-second benchmark termination guard, allowing the MediaPipe detection loop (`requestAnimationFrame`) to operate continuously until the athlete explicitly stops the session or unmounts the component.

## Because

Un-distorting normalized coordinates with the camera aspect ratio ensures that 2D biomechanical angles represent true physical joint kinematics across any webcam, phone, or monitor resolution. Removing the benchmark timer enables uninterrupted tracking for real-world strength training sessions of arbitrary duration.

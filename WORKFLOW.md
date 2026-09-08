---
Project Name: AI-Powered Weightlifting Form Analysis System
Document Name: Workflow Document
Version: 1.0
Date: 2026-08-20
Status: Draft
---

# Workflow Document

## 1. Overview

This document describes how a user and the system flow through a session, from onboarding to post-session review, for V1's three supported exercises (Squat, Deadlift, Bench Press). It complements `PRD.md` (what/why) and `ARCHITECTURE.md` (technical structure) and must remain consistent with both — same three exercises, same "no video stored" policy, same MediaPipe-based pose pipeline.

## 2. High-Level Workflow

```mermaid
flowchart TD
    A[Open Application] --> B[Google OAuth Gateway - LoginPage]
    B -->|Authenticate| C[Authenticated App Shell]
    C -->|Optional| D[Biomechanics Calibration - Live Camera]
    C -->|Start Workout| E[Workout Page - Camera View]
    E --> F[Real-Time Capture, Pose Detection, Rep & Form Analysis]
    F --> G[Real-Time Feedback per Rep]
    G --> H{Complete set?}
    H -- No --> F
    H -- Yes --> I[End Session & Aggregate Form Score]
    I --> J[Save Structured Session Data to SQLite]
    J --> K[Display Session Summary Modal]
    K --> L[View Athlete Dashboard & Analytics]
```

## 3. User Journey

1. **Google OAuth Gate:** User lands on `LoginPage.jsx` and signs in with their Google account email.
2. **Personal Calibration (Optional but Recommended):** User navigates to `CalibrationPage.jsx`, where live MediaPipe camera tracking captures standing and deep squat inflection to calculate personalized femur/torso and shin/torso ratios.
3. **Live Workout:** User navigates to `WorkoutPage.jsx`, positions themselves 6–8 feet from the webcam, and clicks "Start Set".
4. **Real-Time Kinematics:** The system tracks joint angles live on-device, counts deep squat reps, and displays single debounced feedback cues directly on the video HUD.
5. **Session Completion:** User clicks "End Set". A structured summary modal displays rep count, duration, form score, and flagged issues, and saves the session to SQLite via `POST /api/sessions`.
6. **Dashboard Review:** User views historical progress, average form score, personal bests, and priority flaw breakdowns on `DashboardPage.jsx`.

## 4. Camera Initialization Workflow

```mermaid
flowchart TD
    A[Request Camera Access] --> B{Permission Granted?}
    B -- No --> C[Show Permission-Denied Error + Instructions]
    B -- Yes --> D[Start Video Stream]
    D --> E[Run Positioning/Visibility Check]
    E --> F{Person Fully Visible & Well Lit?}
    F -- No --> G[Show Positioning Guidance]
    G --> E
    F -- Yes --> H[Ready to Start Workout]
```

Positioning guidance is exercise-specific (see Section 10–12): e.g., Squat/Deadlift benefit from a side-on view capturing full body and floor; Bench Press benefits from a front/side angle capturing the bar path and elbows.

## 5. Exercise Selection Workflow

```mermaid
flowchart TD
    A[User Opens Exercise Selector] --> B[User Selects Squat / Deadlift / Bench Press]
    B --> C[System Loads Exercise-Specific Config: states, thresholds, rules]
    C --> D[Proceed to Camera Initialization]
```

Automatic exercise recognition (inferring the exercise without user selection) is explicitly future scope, not V1.

## 6. Pose Detection Workflow

```mermaid
flowchart TD
    A[Incoming Video Frame] --> B[Pose Estimation Model]
    B --> C[33 Body Landmarks: x, y, z, visibility]
    C --> D{Landmark Confidence Sufficient?}
    D -- No --> E[Mark Frame Low-Confidence / Skip]
    D -- Yes --> F[Pass to Landmark Processing]
```

## 7. Landmark Processing Workflow

```mermaid
flowchart TD
    A[Raw Landmarks per Frame] --> B[Temporal Smoothing / Filtering]
    B --> C[Compute Joint Angles Needed for Selected Exercise]
    C --> D[Update Rolling Buffer for State Machine]
```

Smoothing exists because per-frame pose estimates jitter slightly even when the body is stationary; without filtering, this jitter can cross state thresholds and create false positives such as extra reps or spurious violations.

## 8. Exercise Verification Workflow

```mermaid
flowchart TD
    A[Smoothed Landmarks + Angles] --> B[Compare Observed Movement Pattern to Selected Exercise Profile]
    B --> C{Reasonably Matches Selected Exercise?}
    C -- No --> D[Show 'Movement Doesn't Match Selected Exercise' Feedback]
    C -- Yes --> E[Proceed to Movement/Rep Detection]
```

Verification is a coarse sanity check (e.g., is the hip/knee/torso motion pattern broadly squat-like), not a separate exercise classifier model.

## 9. Rep Detection Workflow

```mermaid
stateDiagram-v2
    [*] --> Standing
    Standing --> Descending: downward motion exceeds threshold
    Descending --> Bottom: velocity ~0 near expected depth
    Bottom --> Ascending: upward motion exceeds threshold
    Ascending --> Standing: returns to start-position band
    Standing --> [*]
    note right of Standing
      One full cycle
      = 1 repetition
    end note
```

Each exercise defines its own states, angle/position thresholds, and hysteresis bands (a small "dead zone" between switching states) to avoid oscillation from noisy input. Thresholds are configuration values, not hard-coded constants, so they can be tuned per exercise or later personalized.

## 10. Squat Workflow

```mermaid
flowchart TD
    A[Standing: hips/knees near extension] --> B[Descending: knee & hip angles decreasing]
    B --> C[Bottom: depth threshold reached, angular velocity ~0]
    C --> D[Ascending: knee & hip angles increasing]
    D --> E[Standing: back to start-position band]
    E --> F[Rep Counted]
    F --> G[Evaluate: depth, knee alignment, torso angle, trajectory, rep duration]
    G --> H[Emit prioritized feedback if a rule is violated]
```

## 11. Deadlift Workflow

```mermaid
flowchart TD
    A[Setup: bar/hands at start position, hips loaded] --> B[Pull: hip & knee angles increasing together]
    B --> C[Lockout: hip and knee angles reach near-extension]
    C --> D[Descent: controlled return to setup]
    D --> E[Setup: back to start-position band]
    E --> F[Rep Counted]
    F --> G[Evaluate: hip/knee coordination, torso/back angle, lockout completeness, trajectory]
    G --> H[Emit prioritized feedback if a rule is violated]
```

## 12. Bench Press Workflow

```mermaid
flowchart TD
    A[Lockout: elbows near full extension] --> B[Descending: elbow angle decreasing, bar toward chest]
    B --> C[Bottom: bar near chest, angular velocity ~0]
    C --> D[Press: elbow angle increasing]
    D --> E[Lockout: elbows extended again]
    E --> F[Rep Counted]
    F --> G[Evaluate: elbow angle, shoulder position, arm symmetry where visible, range of motion]
    G --> H[Emit prioritized feedback if a rule is violated]
```

## 13. Form Analysis Workflow

```mermaid
flowchart TD
    A[Rep Completed: full landmark/angle history for the rep] --> B[Apply Exercise-Specific Geometric Rules]
    B --> C[Collect Rule Violations with Severity]
    C --> D[Rank Violations by Priority]
    D --> E[Select Top Violation for Real-Time Feedback]
    C --> F[Store All Violations for Session/Post-Set Analysis]
```

Form analysis is deliberately separated from rep detection and metric calculation: rep detection decides *whether* a rep happened, metric calculation computes *numbers* (angles, ROM, tempo), and form analysis interprets those numbers against rules to decide *what*, if anything, is wrong.

## 14. Real-Time Feedback Workflow

```mermaid
flowchart TD
    A[Top-Priority Violation or OK Status] --> B{Is it a Camera/Visibility Issue?}
    B -- Yes --> C[Show Visibility Feedback e.g. 'Move into frame']
    B -- No --> D{Is it a Form Issue?}
    D -- Yes --> E[Show Specific, Actionable Cue e.g. 'Keep knees aligned with feet']
    D -- No --> F[Show Positive/Neutral Status]
    C --> G[Update Feedback Overlay]
    E --> G
    F --> G
```

Only one message is shown at a time; the system suppresses lower-priority cues while a higher-priority one is active for the current rep.

## 15. Session Completion Workflow

```mermaid
flowchart TD
    A[User Ends Session] --> B[Stop Camera Capture]
    B --> C[Aggregate Per-Rep Metrics into Session Metrics]
    C --> D[Compute Weighted Form Score 0-100]
    D --> E[Compile Session Summary]
    E --> F[Persist Structured Session Data]
    F --> G[Discard In-Memory Video Frames]
    G --> H[Show Summary to User]
```

## 16. Data Storage Workflow

```mermaid
flowchart TD
    A[Session Summary Object] --> B[Backend API]
    B --> C{Validation OK?}
    C -- No --> D[Return Error to Client]
    C -- Yes --> E[Write Structured Record to Database]
    E --> F[Confirm Save to Client]
```

No frame or video data is included in the object sent to the backend; only structured fields (Section 16 of `PRD.md`) are transmitted and stored.

## 17. Dashboard Workflow

```mermaid
flowchart TD
    A[User Opens Dashboard] --> B[Request Session History from Backend]
    B --> C[Backend Queries Database for User's Sessions]
    C --> D[Compute Trends: ROM, consistency, common issues, progress]
    D --> E[Render: Session List, Totals, Averages, Trend Charts]
```

## 18. Error Handling Workflow

```mermaid
flowchart TD
    A[Error Detected] --> B{Error Type}
    B -- Camera unavailable --> C[Show device-not-found message; suggest checking connections/permissions]
    B -- Permission denied --> D[Show instructions to re-enable camera permission]
    B -- Person not visible / partially out of frame --> E[Pause analysis; show reposition guidance]
    B -- Poor lighting --> F[Pause analysis; suggest lighting fix]
    B -- Low pose confidence --> G[Pause analysis; show generic visibility warning]
    B -- Incorrect exercise movement --> H[Show exercise-mismatch warning; continue monitoring]
    B -- Temporary detection failure --> I[Retry next frame silently; escalate if persistent]
    B -- Backend unavailable --> J[Queue session data locally if possible; notify user; retry]
    B -- Database failure --> K[Show save-failed message; allow retry]
```

## 19. Edge Cases

* User steps fully out of frame mid-rep: the in-progress rep is not counted; the system returns to a neutral state once the user re-enters frame and visibility is restored.
* User performs an exercise different from the one selected: exercise verification flags the mismatch; reps are not counted against the wrong exercise's rules.
* Extremely fast or extremely slow reps: handled via configurable tempo bounds; unusually fast reps may be flagged for low confidence rather than silently counted.
* Multiple people in frame: V1 assumes a single primary user; secondary people in frame are not tracked (documented limitation).
* Session ended abruptly (e.g., browser closed) before summary is saved: partial data, if any was buffered, may be lost — handled as a known limitation, with future scope covering more robust session recovery.

## 20. Example End-to-End Session

1. User opens the app, logs in, selects **Squat**.
2. Camera permission is granted; positioning check confirms full-body visibility from a side angle.
3. User starts the set. Frame-by-frame: pose estimation → smoothing → angle calculation → exercise verification (confirms squat-like motion) → state machine tracks Standing → Descending → Bottom → Ascending → Standing.
4. Rep 1 completes; form analysis finds knees drifting inward past threshold; feedback shows "Keep your knees aligned with your feet."
5. Reps 2–5 complete with no rule violations above threshold; feedback shows a neutral/positive status.
6. User ends the session after 5 reps.
7. System aggregates metrics: average depth, tempo, one flagged knee-alignment issue on 1 of 5 reps, computed form score (e.g., 84/100).
8. Structured session record (no video) is saved via the backend API.
9. Summary screen shows the score, rep count, and the flagged issue.
10. Dashboard updates: this session is added to the user's Squat history, and the "knee alignment" issue is logged as a recurring/one-off pattern depending on history.

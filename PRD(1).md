---
Project Name: AI-Powered Weightlifting Form Analysis System
Document Name: Product Requirements Document (PRD)
Version: 1.0
Date: 2026-08-20
Status: Draft
---

# Product Requirements Document

## 1. Document Overview

This document defines the product requirements for **V1** of the AI-Powered Weightlifting Form Analysis System, a webcam-based application that gives fitness users automated, non-medical feedback on their exercise technique for three exercises: Squat, Deadlift, and Bench Press. It should be read alongside `WORKFLOW.md` (user/system flow) and `ARCHITECTURE.md` (technical structure); all three documents describe the same V1 system.

## 2. Product Vision

A user stands in front of a laptop/webcam, selects an exercise, and performs their set. The system estimates the user's body pose in real time, verifies the movement matches the selected exercise, counts repetitions, calculates joint-angle and range-of-motion metrics, flags common technique issues against exercise-specific rules, and gives simple, prioritized feedback during and after the set. Session-level statistics (not video) are stored so the user can track technique and consistency over time on a dashboard. The architecture is intentionally modular so later versions can add exercises, sports, camera angles, and ML-based form classification.

The system is an **exercise-technique feedback tool**, not a medical or diagnostic device.

## 3. Problem Statement

Most people training without a coach cannot see their own form in real time and have no objective, repeatable way to track technique quality across sessions. Filming and manually reviewing sets is slow and subjective. A lightweight, camera-based system that gives immediate, specific feedback and keeps a structured history addresses this gap without requiring wearable sensors or expensive equipment.

## 4. Objectives

1. Detect body landmarks from a single webcam in real time using pose estimation.
2. Reliably count repetitions for Squat, Deadlift, and Bench Press using a per-exercise movement state machine.
3. Compute exercise-specific biomechanical metrics (joint angles, ROM, tempo, symmetry where feasible).
4. Detect a defined set of common form issues per exercise using geometric rules, not a black-box classifier.
5. Give the user simple, specific, prioritized feedback in real time and a more detailed post-set/session summary.
6. Persist structured session data (not video) and present it through a history/progress dashboard.
7. Keep the pose-estimation and form-analysis components modular so models, exercises, and sports can be added later.

## 5. Target Users

* Recreational and intermediate lifters training without a coach.
* Students/gym-goers who want objective, repeatable feedback on technique.
* College evaluators/instructors assessing the project as a software engineering exercise.

Not targeted in V1: elite/competitive athletes needing biomechanics-lab precision, clinical rehabilitation patients, or users needing medical clearance decisions.

## 6. User Personas

**Persona A — "Solo Gym-Goer" (Primary).** Trains alone 3–5x/week, knows basic lifts, wants a sanity check on depth/back position without asking a stranger to spot-check form. Wants fast, non-judgmental, actionable cues.

**Persona B — "Data-Driven Beginner".** New to lifting, wants to build good habits early and likes seeing numeric progress (form score, ROM trend) to know if they are improving.

**Persona C — "Evaluator/Instructor" (Secondary).** Reviews the project's dashboard and reports to assess technical soundness rather than to train personally.

## 7. Scope

### 7.1 In Scope (V1)
* Single-user, single-camera (laptop/webcam) sessions.
* Three exercises: Squat, Deadlift, Bench Press.
* Manual exercise selection with automated movement-vs-selection verification.
* Real-time pose estimation, rep detection, geometric form analysis, and feedback.
* Post-session aggregate metrics, form score, and history dashboard.
* Storage of structured session data only (no video retention).

### 7.2 Out of Scope (V1)
See Section 9.

## 8. V1 Features

* Camera capture and visibility/quality checks (framing, lighting, occlusion, confidence).
* Exercise selection UI.
* Real-time pose landmark extraction and smoothing.
* Exercise verification against the selected exercise.
* Per-exercise rep-detection state machine.
* Per-exercise geometric form-analysis rules (Squat, Deadlift, Bench Press).
* Real-time text/visual feedback, prioritized to the single most important issue at a time.
* Per-rep and per-session metric calculation (angles, ROM, tempo, consistency, violations).
* Configurable, explainable 0–100 form score.
* Structured session storage (no video).
* History dashboard (sessions, trends, common issues, progress).
* Error/edge-case handling for camera and detection failures.

## 9. Out of Scope (V1)

* Injury diagnosis, medical claims, or any clinical assessment.
* Automatic exercise recognition without user selection (future scope).
* Exercises beyond Squat, Deadlift, Bench Press.
* Multi-camera / multi-angle capture, mobile app, and 3D pose estimation.
* Voice feedback.
* Coach/athlete multi-account relationships.
* Cloud-trained, exercise-specific ML form classifiers (V1 uses geometric rules, not learned classifiers).
* Permanent storage of workout video.

## 10. User Stories

* As a user, I want to select an exercise before starting so the system analyzes the right movement.
* As a user, I want the system to tell me if it can't see me properly so I can reposition before wasting a set.
* As a user, I want a rep counter that matches what I actually did so I trust the rest of the feedback.
* As a user, I want one clear, specific cue at a time during my set instead of a wall of warnings.
* As a user, I want a form score and summary after my set so I know how it went overall.
* As a user, I want to see my history over time so I can tell if my technique is improving.
* As a user, I want assurance that my video isn't being stored, only my stats.
* As an evaluator, I want the system to clearly state its limitations rather than overclaim accuracy.

## 11. Functional Requirements

| ID | Requirement |
|----|-------------|
| FR-001 | The system shall let the user select one exercise (Squat, Deadlift, Bench Press) before starting a session. |
| FR-002 | The system shall request and use webcam access only after explicit user permission. |
| FR-003 | The system shall run pose estimation on the live camera feed and extract body landmarks (shoulders, elbows, wrists, hips, knees, ankles, and other relevant points). |
| FR-004 | The system shall assess frame quality (framing, lighting, occlusion, landmark confidence) before and during analysis. |
| FR-005 | The system shall warn the user and pause analysis when visibility is insufficient, rather than produce unreliable feedback. |
| FR-006 | The system shall smooth/filter landmark data to reduce noise-driven false detections. |
| FR-007 | The system shall verify that the observed movement reasonably matches the selected exercise before counting reps. |
| FR-008 | The system shall detect exercise-specific movement states (e.g., standing → descending → bottom → ascending → standing for Squat) using a configurable per-exercise state machine. |
| FR-009 | The system shall count one repetition per completed movement-state cycle. |
| FR-010 | The system shall calculate exercise-specific joint angles and derived metrics per repetition. |
| FR-011 | The system shall apply exercise-specific geometric rules to detect a defined set of common form issues. |
| FR-012 | The system shall generate specific, actionable real-time feedback rather than generic "bad form" messages. |
| FR-013 | The system shall prioritize and display at most the single most important form issue at a time during a rep. |
| FR-014 | The system shall calculate session-level aggregate metrics (rep count, tempo, ROM, consistency, violation counts) at the end of a session. |
| FR-015 | The system shall calculate a configurable, weighted 0–100 form score from defined sub-components. |
| FR-016 | The system shall store structured session data (exercise, timestamps, rep count, metrics, form score, detected issues) without storing workout video. |
| FR-017 | The system shall display a dashboard of past sessions, trends, and common form issues over time. |
| FR-018 | The system shall handle and clearly report error conditions (camera unavailable/denied, person not visible, low pose confidence, incorrect exercise movement, backend/database unavailable). |
| FR-019 | The system shall state, in-product, that it is not a medical diagnostic tool. |

## 12. Non-Functional Requirements

See `ARCHITECTURE.md` Section on Non-Functional targets for technical detail; from a product standpoint:

* **Performance:** Real-time feedback should feel responsive during a set (target sub-second perceived latency on typical laptop hardware); exact frame-rate targets are defined in the architecture document and are aspirational, not guaranteed.
* **Reliability:** The system should degrade gracefully (pause/warn) rather than silently produce wrong feedback when input quality is poor.
* **Privacy:** No video is retained; only structured metrics are stored.

* **AI Coaching:** The system may generate post-session coaching from structured workout metrics and personalized calibration data. Coaching responses must be grounded in retrieved, approved guidance and must not diagnose injuries or invent measurements.

* **Personalized Analysis:** Calibration must capture individual limb proportions and standing/bottom joint-angle baselines so form thresholds can adapt to different body types and mobility patterns.
* **Usability:** Feedback text should be understandable by a non-expert gym-goer.
* **Extensibility:** New exercises/sports should be addable without rewriting the core pipeline.
* **Maintainability & Scalability:** See architecture document.

## 13. Form Analysis Requirements

* Form analysis for V1 shall use **pose estimation + geometric/biomechanical calculations + exercise-specific rules**, not a trained form-classification model.
* Squat, Deadlift, and Bench Press each require a distinct rule set, distinct movement states, and distinct threshold configuration (see `WORKFLOW.md` and `ARCHITECTURE.md`).
* Any metric that cannot be reliably estimated from a single webcam view (e.g., precise 3D bar path, exact spinal loading) shall be explicitly labeled as a limitation rather than presented as accurate.

## 14. Metrics

The system shall attempt to compute, where feasible from a single camera view: rep count, rep duration, tempo, per-exercise joint angles, range of motion, movement consistency across reps, form-violation counts, form score, and session/multi-session aggregates. See PRD Section 11 (FR-010, FR-014) and Architecture Section on the Metrics Engine for detail.

## 15. Feedback Requirements

* Feedback shall be text-based and/or simple visual overlays for V1; voice feedback is future scope.
* Feedback must be specific and actionable (e.g., "Keep your knees aligned with your feet"), never a bare "bad form."
* The system shall avoid overwhelming the user with simultaneous warnings — the most important issue is surfaced first.
* Camera/visibility problems shall be communicated as feedback (e.g., "Camera visibility is insufficient. Please move into frame.").

## 16. Data Requirements

* Store: user identifier, exercise type, date/time, rep count, per-rep and session metrics, form score, detected form issues, session duration, derived statistics.
* Do not store: raw or processed workout video, by default.
* Avoid collecting personally identifiable information beyond what is required to operate user accounts/sessions.

## 17. Privacy Requirements

* Video frames are processed transiently for analysis and are not persisted.
* Only the structured data listed in Section 16 is stored.
* The system should minimize PII collection and should clearly disclose data practices to the user.
* See `ARCHITECTURE.md` Section on Security/Privacy for technical enforcement and `PROJECT_REPORT.tex` Chapter 9 for a fuller ethical discussion.

## 18. Dataset Strategy

V1's rule-based form analysis does not require a large proprietary dataset and can be implemented using pose landmarks and hand-authored geometric rules alone. Publicly available datasets are relevant mainly as a **future/optional** input for calibrating thresholds or eventually training a learned form classifier. Datasets identified as potentially relevant (with caveats):

* **UI-PRMD** (University of Idaho Physical Rehabilitation Movement Data) — publicly available, skeletal/joint-angle data (Vicon + Kinect) for 10 rehabilitation movements (e.g., deep squat, sit-to-stand) performed correctly and incorrectly by 10 subjects. Useful as a reference for correct-vs-incorrect movement structure and for calibrating squat-like joint-angle thresholds, but it is a **rehabilitation**, not weightlifting, dataset — movements, loads, and populations differ from gym lifts, and it does not include Deadlift or Bench Press. License: Open Data Commons Public Domain Dedication and License v1.0.
* **KIMORE** — publicly available (on request), RGB-D video plus skeleton joint positions/orientations for rehabilitation exercises, including physician-assigned quality scores. Useful as an example of how to structure an explainable "clinical" quality score, but again rehabilitation-focused, not weightlifting-specific, and comes from a clinical/physiotherapy context rather than a gym setting.
* **MM-Fit** — a multi-modal (IMU + pose) fitness/workout dataset used in academic work on exercise recognition and rep counting; useful as a reference for rep-counting evaluation methodology on fitness (not just rehab) movements. Coverage of barbell lifts specifically (Squat/Deadlift/Bench Press) is limited compared to bodyweight/dumbbell fitness moves, so it is more useful methodologically than as training data for these three lifts.
* A dataset of **specifically labelled Squat/Deadlift/Bench Press form errors** at scale was not identified as a verified, freely licensed, ready-to-use public resource at the time of writing; this should be treated as an open gap rather than assumed to exist. V1 does not depend on such a dataset.

V1 remains fully implementable with pose landmarks + rules even without any of the above; a future version could use expert-labelled gym-lift data (if collected or licensed) to train/calibrate a learned classifier.

## 19. Success Criteria

* All three exercises produce rep counts that a human reviewer judges correct for a majority of test sets under normal camera conditions.
* Form-issue detections correspond to rules a domain-informed reviewer (e.g., an experienced lifter) agrees are reasonable proxies for the named issue.
* The system correctly identifies and reports low-visibility conditions rather than emitting confident-but-wrong feedback.
* A user can review a full session's history and metrics on the dashboard after the session ends.
* No workout video is found in persistent storage.

## 20. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Single-camera occlusion/angle causes inaccurate angle estimates | Explicit visibility checks, exercise-specific recommended camera placement, explicit limitation statements for unreliable metrics |
| Noisy landmarks cause false rep counts | Smoothing/filtering, hysteresis thresholds in the state machine |
| Users over-trust the form score as a medical/professional judgment | Clear in-product disclaimers; frame the score as heuristic and configurable |
| Threshold values don't generalize across body types | Make thresholds configurable per exercise and document them as heuristic, calibratable in future iterations |
| Scope creep beyond three exercises / V1 features | Explicit Out-of-Scope section; future scope tracked separately |

## 21. Assumptions

* The user has a single laptop/webcam with reasonable resolution and lighting, positioned per exercise-specific guidance.
* One user is visible in frame at a time.
* The user selects the correct exercise before starting.
* Internet/backend availability for storage and dashboard; local operation may be degraded when offline (future scope covers offline processing).

## 22. Limitations

* A single 2D/monocular webcam cannot fully resolve depth, exact spinal load, or true 3D bar path; such metrics are explicitly flagged as approximate or unavailable.
* The system cannot diagnose injuries, guarantee injury prevention, or replace a qualified coach.
* Form rules are heuristic and threshold-based, not the output of a validated clinical/biomechanical model.
* Accuracy depends heavily on camera placement, lighting, and clothing contrast.

## 23. Future Scope

Mobile application; multiple camera angles; automatic exercise recognition; additional exercises and sports; personalized/adaptive thresholds; ML-based form classification trained on expert-labelled data; voice feedback; improved 3D pose estimation; cloud and/or offline processing options; coach/athlete multi-user accounts.

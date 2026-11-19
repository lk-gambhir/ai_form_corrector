# 08: View-Aware Biomechanics Form Rules, Dynamic Scoring Weighting, and Persistent Visual Feedback

**Author:** Divjot Singh  
**Roll No.:** 1024031028  
**Module:** Biomechanics Form Rules, View-Aware Quality Evaluation & Feedback Selection  

## Error:

Building upon the repetition state machines and form rules developed in Journal 03, 04, and 07, the form evaluation engine evaluated rules globally regardless of camera perspective. Lateral (side-view) squat sets were being penalized for `knee_valgus` (an inward knee collapse that is only optically measurable in the frontal plane), while frontal sets were evaluated for `torso_lean` and `depth` (which require lateral perspective). In addition, using a rigid $20^\circ$ torso lean threshold with aspect-corrected coordinates falsely failed anatomically sound squats, and coaching cues flashed on screen for only a single video frame (33ms) upon rep completion, making them impossible for athletes to read.

## Relevant Context

In Journal 04 and 07, we established that repetition detection must be decoupled from quality evaluation:
- State machines (Journal 03 and 07) determine *when* an intentional repetition begins and ends.
- The `FormRuleEngine` (Journal 04) evaluates *how well* the repetition was performed against biomechanical standards.
- The `FeedbackSelector` (Journal 04) ranks defect severity and debounces competing messages.

However, real-world lifters place webcams at varying angles:
1. **Sagittal / Lateral View (Side):** Required for measuring knee flexion depth, hip hinge excursion, and torso inclination. Frontal knee valgus is occluded and unmeasurable.
2. **Frontal View (Front):** Required for measuring bilateral knee valgus (inward displacement relative to ankle/hip). Torso lean and hip depth cannot be accurately resolved.

## Key Observation

1. **View-Aware Score Normalization:** Penalizing a lifter for an unmeasured plane is a defect in rule evaluation. When evaluating form score, rules whose required landmarks or planes are absent must not register as failures; instead, scoring weights must dynamically normalize across only the rules that were actively measurable in that view.
2. **Torso Lean Recalibration:** With the introduction of isotropic aspect-ratio coordinate scaling, true 2D torso inclination angles are no longer compressed. A $20^\circ$ torso lean cap was excessively restrictive for long-femur lifters performing low-bar or parallel squats; raising the cap to $30^\circ$ reflects validated biomechanical standards (PMC6050534).
3. **Repetition Feedback Latch:** In Journal 04, we introduced cue debouncing during active movement. However, when a rep completes at the transition from ASCENT back to STANDING, the state machine transitions in a single frame. The resulting coaching cue must be latched for a minimum cognitive reading duration ($2.5$ seconds) before reverting to neutral tracking.

## Solution

1. **View-Aware Rule Evaluation (`frontend/src/analysis/FormRuleEngine.js`):**
   Integrated view-plane verification into the rule evaluation pipeline. For the back squat, `knee_valgus` is only scored when frontal landmarks meet visibility thresholds; otherwise, the score dynamically distributes weight across measurable rules (`depth`, `torso_lean`, `tempo`).

2. **Threshold & Metric Recalibration (`exercises/squat/config/exercise.config.js`):**
   - Calibrated the baseline squat torso lean threshold to $30^\circ$ with aspect-corrected geometry.
   - Incorporated cadence and tempo rules ($0.5\text{s} - 12\text{s}$) to penalize dive-bombing or stalling at the turnaround point.

3. **Deadlift Setup Angle Verification (`exercises/deadlift/config/exercise.config.js`):**
   Enhanced the deadlift `movement_range` rule to record and verify the true initial setup hinge angle at the floor, preventing partial pulls from passing range-of-motion criteria.

4. **Feedback Latch Window (`frontend/src/pipeline/AnalysisPipeline.js`):**
   Configured `CUE_HOLD_MS = 2500` in the analysis pipeline. When a repetition completes, the feedback selector's highest-severity cue is latched on screen for 2500ms, ensuring lifters can absorb the feedback before the HUD clears for the next repetition.

## Because

View-aware rule evaluation prevents false-positive penalties from occluded camera planes, recalibrated thresholds align with true physical kinematics, and latching post-rep cues ensures that real-time feedback is visually digestible and actionable during live athletic training.

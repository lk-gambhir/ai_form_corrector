# 07: Push-up and Deadlift Biomechanics, Kinematic Cycles, and Decoupled Repetition Evaluation

**Author:** Divjot Singh  
**Roll No.:** 1024031028  
**Module:** Push-up & Deadlift State Machines, Kinematic Cycles, and Decoupled Repetition Evaluation  

## Error:

Coupling rep attempt thresholds directly to form quality criteria (depth and lockout) caused shallow push-ups and soft-lockout deadlifts to either be discarded as non-repetitions or fail prematurely. In the deadlift, using a standard upward excursion detector caused the state machine to close repetitions prematurely midway through the ascent upon reaching the threshold, truncating evaluation before terminal extension could be measured.

## Relevant Context

Push-ups and conventional deadlifts exhibit distinct kinematic cycles compared to the back squat:
1. **Standard floor Push-up**: The movement initiates from a full plank (elbow angle ~160°), lowers until the upper arms reach parallel with the floor (elbow flexion <= 90°), and presses back up to the starting position while preserving a straight shoulder-to-ankle alignment (ATP 7-22.01 & NASM).
2. **Conventional Deadlift**: The movement initiates from a floor/barbell setup position (hip hinge angle ~85°), pulls to full upright standing lockout (hip angle >= 165°), and completes upon a controlled return of the barbell to the floor (NASM & PMC10128119).

The generic `AngleExcursionDetector` models cyclic movements by tracking a primary joint angle as it moves from a baseline (`startThreshold`), passes an inflection (`excursionThreshold`), and returns to the baseline.

## Key Observation

Repetition volume and repetition form quality have fundamentally distinct kinematic criteria:
- **Repetition Decoupling in Push-ups:** An elbow flexion crossing $\le 115^\circ$ confirms an intentional repetition attempt (distinguishing it from resting camera jitter or setup shifts). If the detector required $\le 90^\circ$ to count a rep, an athlete doing a shallow rep (e.g. $105^\circ$) would see zero reps registered. By setting `excursionThreshold: 115`, the rep is counted in workout volume, while the `range_of_motion` form rule independently evaluates whether depth met the $\le 90^\circ$ standard and logs a defect if it failed.
- **Inverted Deadlift Kinematic Cycle:** Unlike squats which begin at full standing extension ($180^\circ$) and descend, a deadlift begins at the floor in flexion ($\sim 85^\circ - 95^\circ$). If modeled with `invert: false` and `startThreshold: 145`, the detector triggers rep completion the instant the ascending lifter crosses $145^\circ$, finishing the rep mid-pull and falsely evaluating lockout before the lifter reaches terminal extension. By configuring `invert: true`, `startThreshold: 75`, and `excursionThreshold: 35`:
  - Setup at floor: Signal = $|180^\circ - 85^\circ| = 95^\circ$ (above `startThreshold: 75`).
  - Standing lockout: Signal = $|180^\circ - 172^\circ| = 8^\circ$ (below `excursionThreshold: 35`).
  - Return to floor: Signal returns above $75^\circ$, completing the rep upon returning the barbell to the floor. The `lockout` rule (`hipLockoutDeg >= 165`) evaluates the true peak extension reached during the pull.

## Solution

1. **Push-up Kinematic & Form Configuration (`exercises/push_up/config/exercise.config.js`):**
   - Repetition detector configured with `excursionThreshold: 115` on `elbow_flexion` so shallow attempts are counted.
   - Quality rules independently evaluate form:
     - `range_of_motion`: `elbowBottomDeg <= 90` (failure flagged if depth is shallow).
     - `body_alignment`: `maxBodyLineDeviationDeg <= 25` (flags excessive sagging or piking).

2. **Deadlift Inverted Cycle Configuration (`exercises/deadlift/config/exercise.config.js`):**
   - Configured `invert: true`, `startThreshold: 75`, and `excursionThreshold: 35` on `hip_hinge`.
   - Quality rules evaluate peak lockout and range:
     - `lockout`: `hipLockoutDeg >= 165` (flags soft lockout if hip extension stalls short).
     - `movement_range`: `totalRoMDeg >= 55`.

3. **Modular Adapter Integration:**
   - Integrated with the exercise registry in `exercises/` where each activity cleanly provides its own `ExerciseAdapter.js` and configuration without fragile global if/else branching.

## Because

Decoupling rep counting from quality evaluation provides honest volume tracking while holding form to strict biomechanical standards. Inverting the deadlift state machine accurately models the floor-to-lockout-to-floor physical movement cycle, preventing premature completion artifacts.

# 07: Activity-Isolated Personal Calibration and Biomechanics RAG Routing

**Author:** Gagandeep Singh  
**Roll No.:** 1024031027  
**Module:** Multi-Exercise Personal Calibration & AI Coaching RAG Architecture  

## Error:

Personal calibration was hardcoded to squat anthropometrics (femur-to-torso and shin-to-torso ratios), contaminating push-up and deadlift sessions with irrelevant limb proportions. Additionally, the coaching service lacked knowledge retrieval filtering by exercise, allowing squat depth cues and knee guidance to leak into push-up and deadlift post-workout feedback.

## Relevant Context

Anthropometric calibration and AI coaching must be strictly activity-specific:
1. **Push-up calibration:** Requires baseline plank posture (neutral shoulder-hip-ankle alignment) and baseline elbow flexion range, without limb ratios.
2. **Deadlift calibration:** Requires standing hip extension baseline and hip hinge setup angle, without squat-specific shin angle expectations.
3. **Biomechanical RAG Coaching:** The TF-IDF retrieval system in `backend/app/knowledge/retriever.py` queries a shared `knowledge_base.json`. When queries match on generic terms like "range of motion" or "depth", squat documents could score higher than deadlift or push-up documents unless strictly pre-filtered.

## Key Observation

1. **Calibration Isolation:** Calibration data contracts must isolate exercise profiles: `limbRatios` are only meaningful for squat biomechanics, while push-up and deadlift rely on neutral alignment vectors and joint angle baselines. Allowing squat limb ratios to persist across other exercises produces nonsensical biomechanical comparisons.
2. **Deterministic Retrieval Scoping:** In TF-IDF retrieval, lexical and cosine ranking alone is insufficient across multi-exercise corpora. Hard pre-filtering by `exercise == target_exercise` is mandatory to guarantee zero cross-exercise guidance leakage.

## Solution

1. **Multi-Exercise Calibration Engine (`frontend/src/analysis/CalibrationEngine.js`):**
   - Added `setExercise(exercise)` and exercise-isolated reference profiles:
     - Push-up: plank line alignment baseline and elbow bottom depth baseline; `limbRatios: null`.
     - Deadlift: standing upright lockout baseline and setup hinge angle baseline; `limbRatios: null`.
     - Squat: standing stance and bottom depth; preserves femur/shin-to-torso ratios.
   - Updated `CalibrationView.jsx` with an activity selector dropdown and dynamic, exercise-specific step instructions.

2. **Biomechanical Knowledge Base Expansion (`backend/app/knowledge/knowledge_base.json`):**
   - Curated evidence-grounded articles for Push-up (`pushup-rom-depth`, `pushup-body-alignment`) and Deadlift (`deadlift-lockout-mechanics`, `deadlift-spine-neutrality`), citing US Army ATP 7-22.01, NASM, and NSCA.

3. **Strict Exercise Pre-Filtering (`backend/app/knowledge/retriever.py`):**
   - Filtered candidate document indices strictly by `doc.get("exercise", "squat").lower() == target_exercise` before TF-IDF vectorization and cosine similarity scoring:
   ```python
   # Filter documents by exercise
   candidate_indices = [
       i for i, doc in enumerate(self._docs)
       if doc.get("exercise", "squat").lower() == target_exercise
   ]
   ```

4. **Exercise-Specific AI Coaching (`backend/app/services/coaching.py` & `SessionSummaryModal.jsx`):**
   - Expanded rule mappings to recognize push-up and deadlift rule IDs (`range_of_motion`, `body_alignment`, `lockout`, `movement_range`).
   - Generated tailored biomechanical explanations and actionable cues while strictly barring medical diagnoses.
   - Enabled the coaching summary modal across all activities in the frontend UI.

## Because

Isolating calibration parameters prevents invalid anthropometric assumptions across movement patterns, and hard pre-filtering in the RAG pipeline guarantees that athletes receive rigorous, cited, exercise-appropriate coaching without dangerous or confusing guidance leakage.

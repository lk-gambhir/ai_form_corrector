# AI, RAG, and Personalization Fix Plan

This document turns the code review findings into an implementation checklist.

## 1. Make LLM Usage Explicit

The coaching endpoint falls back to deterministic text when no Gemini key is configured, but the UI always labels the result as AI-generated.

Add a source field to the response:

    source: "llm" or "deterministic"
    model: configured model name or null

Set source to deterministic whenever the fallback is used. Display that status in the coaching panel.

Files:

- backend/app/schemas.py
- backend/app/services/coaching.py
- frontend/src/components/SessionSummaryModal.jsx
- frontend/src/api/coachingApi.js

Tests must cover configured LLM, missing API key, malformed LLM output, and fallback behavior.

## 2. Describe and Improve RAG Accurately

The current retriever is local TF-IDF and keyword matching. It is useful retrieval, but it is not embedding-based semantic RAG.

Keep the TF-IDF retriever as an offline fallback. Add an embedding provider behind the same retrieve interface only when semantic retrieval is needed:

1. Split curated guidance into passages.
2. Generate and persist passage embeddings.
3. Embed the coaching query.
4. Retrieve by cosine similarity.
5. Fall back to TF-IDF if the embedding service is unavailable.

Do not send video to the retrieval service. Update documentation so it describes the implementation that actually exists.

Files:

- backend/app/knowledge/retriever.py
- backend/app/knowledge/knowledge_base.json
- backend/requirements.txt
- backend/app/config.py

Acceptance criteria:

- torso_lean retrieves torso guidance first.
- depth retrieves depth guidance first.
- offline retrieval still works.
- every passage includes a source ID and score.

## 3. Make Personalized Depth Work

The current depth rule uses a minimum operation that usually leaves the target fixed at 90 degrees. This means most calibrated bottom angles do not affect the rule.

Separate:

- personalized target angle
- allowed tolerance
- hard safety boundary

Use a consistent angle convention. Smaller knee angles mean deeper squats. Clamp personalized values to safe configured bounds and test calibrated values of 85, 95, and 110 degrees, plus missing and low-confidence calibration.

Files:

- frontend/src/analysis/FormRuleEngine.js
- shared/exercise-config/squat.config.js
- frontend/src/analysis/CalibrationEngine.js
- backend/app/services/validation.py
- backend/app/services/form_score.py

## 4. Use Limb Ratios in Personalization

Femur-to-torso and shin-to-torso ratios are calculated and persisted, but they do not affect the rules.

Use them as context for expected torso lean, knee travel, and confidence. A longer femur may permit a wider torso-lean range. A large left/right asymmetry should reduce confidence. Ratios must never override hard safety limits.

Test two synthetic athlete profiles and verify that their expected ranges differ while safety limits remain unchanged.

## 5. Actually Calibrate Torso Lean

Calibration currently calculates limb ratios and knee/hip ROM, but not typical torso lean. The backend therefore often uses a default of 15 degrees.

During bottom-position calibration, calculate torso inclination using a defined vertical reference and the shoulder-to-hip vector. Reject low-visibility frames and store a median, spread, and confidence value. Use the same angle convention in calibration and form rules.

Files:

- frontend/src/analysis/CalibrationEngine.js
- frontend/src/components/CalibrationView.jsx
- frontend/src/analysis/FormRuleEngine.js
- backend/app/routers/coaching.py

Test that torso lean appears in the generated baseline, ignores bad frames, and reaches the coaching response.

## 6. Strengthen LLM Validation

Treat model output as untrusted input:

- Restrict primary_issue to known rule IDs or null.
- Require one to three non-empty recommendations.
- Reject non-string recommendations.
- Reject medical diagnoses and guarantees.
- Require a fixed safety disclaimer.
- Use deterministic coaching for every validation failure.

Add tests for empty fields, too many recommendations, unknown issue IDs, malformed JSON, and unsafe advice.

## 7. Simplify the Code Safely

Safe cleanup targets:

- Use typed CoachingMetricsIn and CoachingBaselineIn instead of generic dictionaries.
- Remove unused schema fields and retriever state.
- Keep one clear deterministic fallback.
- Remove comments that merely restate the next line.
- Keep comments explaining security, privacy, safety, and non-obvious algorithms.

Do not delete useful contract or safety comments just to reduce line count.

## 8. Verification

Run:

    backend/.venv/bin/pytest -q
    npm test --workspace frontend -- --run
    npm run build:frontend

Manually verify that:

- Coaching works without an API key.
- LLM responses are marked as LLM output.
- Retrieved evidence matches the detected issue.
- Personalized baseline values appear in explanations.
- Different body profiles produce different thresholds.
- Raw video is never sent to coaching.
- Invalid model output falls back safely.

## Implementation Prompt

Review the weightlifting-form-analyzer repository and implement the fixes in AI_FIX_PLAN.md.

Preserve MediaPipe, deterministic rep detection, and the privacy model. Do not use an LLM to calculate joint angles or count reps.

First fix personalized calibration: calculate torso lean, use robust multi-frame values, and make calibrated depth and torso thresholds affect form rules while preserving hard safety limits. Then make the coaching API strongly typed and add response metadata showing whether output came from Gemini or deterministic fallback.

Keep TF-IDF as an offline fallback. Add semantic embeddings only behind the existing retriever interface, and do not claim embedding-based RAG unless embeddings are implemented.

Validate all LLM output with Pydantic, restrict issue IDs to known rules, reject unsafe responses, and fall back deterministically on failure. Remove redundant comments and unused abstractions while preserving security, privacy, safety, and algorithm comments. Add focused tests and run the full test suites and production build.

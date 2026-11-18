"""
AI Coaching Service.

Combines structured session metrics, personalized calibration baselines, and
retrieved authoritative biomechanics guidance into schema-validated coaching advice.
Supports LLM generation when configured with seamless deterministic fallback.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

import httpx

from app.config import get_settings
from app.knowledge.retriever import BiomechanicsKnowledgeRetriever, get_retriever
from app.schemas import (
    CoachingAnalyzeRequest,
    CoachingAnalyzeResponse,
    RetrievedGuidanceItem,
)

logger = logging.getLogger("coaching")

SAFETY_DISCLAIMER = (
    "Stop and seek qualified medical or physical therapy advice if movement causes pain. "
    "Form analysis is an educational feedback tool, not medical advice."
)

# Only these rule IDs are valid for primary_issue.
KNOWN_RULE_IDS = {
    "depth", "torso_lean", "knee_valgus", "tempo",
    "range_of_motion", "body_alignment",
    "lockout", "movement_range",
}

# Patterns that indicate unsafe medical claims an LLM should never make.
# Word stems are matched with any suffix ("diagnos" -> diagnose, diagnosis,
# diagnosed; "fractur" -> fracture, fractures, fractured; ...).
_UNSAFE_PATTERNS = re.compile(
    r"\b(diagnos\w*|guarantee\w*|cure[sd]?|torn ligaments?|fractur\w*|surger(?:y|ies)|surgical\w*)",
    re.IGNORECASE,
)


def _format_deterministic_coaching(
    request: CoachingAnalyzeRequest,
    retrieved_items: list[RetrievedGuidanceItem],
    passages_raw: list[Any],
) -> CoachingAnalyzeResponse:
    """
    Generates deterministic, grounded coaching advice matching schema exactly.
    Guarantees conservative coaching, zero hallucinated metrics, and max 3 recommendations.
    """
    issues = request.issues
    form_score = round(request.form_score, 1)
    rep_count = request.rep_count

    typical_lean = request.personalized_baseline.typical_torso_lean if request.personalized_baseline else None
    knee_bottom = request.personalized_baseline.knee_bottom_angle if request.personalized_baseline else None
    femur_torso = request.personalized_baseline.femur_to_torso if request.personalized_baseline else None

    # Determine primary issue
    primary_issue: str | None = None
    if issues:
        severity_rank = {"high": 3, "medium": 2, "low": 1}
        sorted_issues = sorted(
            issues,
            key=lambda x: (severity_rank.get(x.severity.lower(), 1), x.count),
            reverse=True,
        )
        primary_issue = sorted_issues[0].type

    # Build Summary
    raw_ex = getattr(request, "exercise", "squat") or "squat"
    exercise_name = "Push-up" if raw_ex == "push_up" else raw_ex.replace("_", " ").title()
    if not primary_issue or form_score >= 90:
        if rep_count > 0:
            summary = (
                f"Your {exercise_name} set of {rep_count} reps demonstrated strong technical consistency, "
                f"achieving a {form_score}% form score."
            )
        else:
            summary = f"{exercise_name} session recorded with zero active repetitions."
    else:
        issue_label = primary_issue.replace("_", " ")
        summary = (
        f"Your {exercise_name} set completed {rep_count} reps with a {form_score}% form score, "
            f"primarily affected by {issue_label}."
        )

    # Build Explanation
    explanation_parts: list[str] = []
    if primary_issue == "torso_lean":
        issue_obj = next((i for i in issues if i.type == "torso_lean"), None)
        count_str = f"on {issue_obj.count} reps" if issue_obj else "during the set"
        if typical_lean is not None:
            explanation_parts.append(
                f"Your torso lean noticeably exceeded your calibrated baseline of {typical_lean}° {count_str}."
            )
        else:
            explanation_parts.append(f"Excessive forward torso lean was detected {count_str}.")

        if femur_torso and femur_torso > 1.05:
            explanation_parts.append(
                f"Given your longer femur proportion (ratio: {femur_torso}), your body naturally hinges forward; "
                f"maintain strong 360° core bracing to prevent thoracic collapse."
            )
        else:
            explanation_parts.append(
                "This typically happens when hip drive outpaces knee extension, shifting load onto the lumbar spine."
            )

    elif primary_issue == "depth":
        issue_obj = next((i for i in issues if i.type == "depth"), None)
        count_str = f"on {issue_obj.count} reps" if issue_obj else "during the set"
        if knee_bottom is not None:
            explanation_parts.append(
                f"Squat depth was shallow {count_str}, reversing before reaching your calibrated depth angle of {knee_bottom}°."
            )
        else:
            explanation_parts.append(
                f"Squat depth did not consistently reach parallel {count_str}."
            )
        explanation_parts.append(
            "Achieving depth with controlled hip descent ensures full quad and glute engagement."
        )

    elif primary_issue == "knee_valgus":
        issue_obj = next((i for i in issues if i.type == "knee_valgus"), None)
        count_str = f"on {issue_obj.count} reps" if issue_obj else "during the set"
        explanation_parts.append(
            f"Your knees moved inward relative to your ankles (knee-to-ankle ratio below 0.9) {count_str} at the bottom of the squat."
        )
        explanation_parts.append(
            "A ratio of 1.0 means the knees are directly over the ankles; this was measured from a front-facing camera."
        )

    elif primary_issue == "tempo":
        issue_obj = next((i for i in issues if i.type == "tempo"), None)
        count_str = f"on {issue_obj.count} reps" if issue_obj else "during the set"
        rep_duration = request.metrics.rep_duration
        duration_str = f" (average rep: {round(rep_duration, 1)} s)" if rep_duration is not None else ""
        explanation_parts.append(
            f"Rep duration fell outside the 0.5-12 second range {count_str}{duration_str}: "
            "faster usually means bouncing out of the bottom, slower means stalling."
        )
        explanation_parts.append(
            "Use a steady, controlled pace that lets you repeat the same movement on every rep."
        )
    elif primary_issue == "range_of_motion":
        issue_obj = next((i for i in issues if i.type == "range_of_motion"), None)
        count_str = f"on {issue_obj.count} reps" if issue_obj else "during the set"
        explanation_parts.append(
            f"Push-up depth was shallow {count_str}, reversing before the elbows reached about 90° of flexion."
        )
        explanation_parts.append(
            "Lowering with controlled elbow flexion (~90°) ensures full chest and triceps engagement."
        )
    elif primary_issue == "body_alignment":
        issue_obj = next((i for i in issues if i.type == "body_alignment"), None)
        count_str = f"on {issue_obj.count} reps" if issue_obj else "during the set"
        explanation_parts.append(
            f"Body alignment deviated {count_str}, indicating sagging hips or arched back."
        )
        explanation_parts.append(
            "Maintaining active core and glute tension keeps shoulders, hips, and ankles in one rigid line."
        )
    elif primary_issue == "lockout":
        issue_obj = next((i for i in issues if i.type == "lockout"), None)
        count_str = f"on {issue_obj.count} reps" if issue_obj else "during the set"
        explanation_parts.append(
            f"Hip lockout was soft or incomplete {count_str} at the top of the deadlift."
        )
        explanation_parts.append(
            "Standing tall with complete hip and knee extension maximizes glute contraction."
        )
    elif primary_issue == "movement_range":
        issue_obj = next((i for i in issues if i.type == "movement_range"), None)
        count_str = f"on {issue_obj.count} reps" if issue_obj else "during the set"
        explanation_parts.append(
            f"Deadlift movement range was truncated {count_str} between floor setup and lockout."
        )
        explanation_parts.append(
            "Returning the bar fully to the starting floor position ensures complete repetition quality."
        )
    else:
        explanation_parts.append(
            f"Every repetition satisfied biomechanical rules with steady control and proper technique."
        )

    explanation = " ".join(explanation_parts)

    # Build Recommendations (Max 3)
    recommendations: list[str] = []
    for p in passages_raw:
        for rec in p.recommendations:
            if rec not in recommendations and len(recommendations) < 3:
                recommendations.append(rec)

    if len(recommendations) < 1:
        if primary_issue == "torso_lean":
            recommendations = ["Use a comfortable range and controlled tempo while keeping your torso steady."]
        elif primary_issue == "depth":
            recommendations = ["Practice a controlled descent and use a repeatable depth that feels comfortable."]
        elif primary_issue == "knee_valgus":
            recommendations = ["Keep your knees tracking consistently with your foot position through the repetition."]
        elif primary_issue == "range_of_motion":
            recommendations = [
                "Lower until your elbows reach about 90° of flexion.",
                "Practice chest-to-pad or incline push-ups to build comfortable full range of motion.",
            ]
        elif primary_issue == "body_alignment":
            recommendations = [
                "Squeeze your glutes and brace your core to keep hips aligned with shoulders and heels.",
                "Incorporate static forearm planks into warmups to reinforce anti-extension trunk rigidity.",
            ]
        elif primary_issue == "lockout":
            recommendations = [
                "Finish each repetition by squeezing the glutes to achieve full, upright hip extension.",
                "Stand tall without leaning back or hyperextending the lower back at the top.",
            ]
        elif primary_issue == "movement_range":
            recommendations = [
                "Initiate each repetition from a stable setup with hips hinged back over midfoot.",
                "Lower the bar under control all the way back to the floor before starting the next rep.",
            ]
        else:
            recommendations = [
                "Maintain your current technical consistency while progressively adding volume.",
                "Keep a steady controlled tempo on all warmup and working sets.",
            ]

    recommendations = recommendations[:3]

    # Next Session Goal
    if primary_issue == "torso_lean":
        if typical_lean is not None:
            next_session_goal = f"Keep torso lean within 3° of your calibrated {typical_lean}° baseline across all reps."
        else:
            next_session_goal = "Maintain an upright chest and firm brace through the entire bottom turnaround."
    elif primary_issue == "depth":
        if knee_bottom is not None:
            next_session_goal = f"Reach your calibrated {knee_bottom}° inflection target on every working rep."
        else:
            next_session_goal = "Ensure hip crease reaches the knee level on each repetition before initiating ascent."
    elif primary_issue == "knee_valgus":
        next_session_goal = "Keep knees tracking directly in line with your second toe from bottom to top."
    elif primary_issue == "tempo":
        next_session_goal = "Keep every rep between 0.5 and 12 seconds with a controlled descent and no pause-and-stall at the bottom."
    elif primary_issue == "range_of_motion":
        next_session_goal = "Lower until your elbows reach about 90° of flexion on every repetition."
    elif primary_issue == "body_alignment":
        next_session_goal = "Keep shoulders, hips, and ankles in one rigid straight line without sagging."
    elif primary_issue == "lockout":
        next_session_goal = "Achieve full upright hip extension and squeeze glutes at the top of each pull."
    elif primary_issue == "movement_range":
        next_session_goal = "Complete each rep by returning the bar fully to the floor setup position."
    else:
        next_session_goal = "Maintain today's technical precision while increasing set volume by 1 rep."

    return CoachingAnalyzeResponse(
        summary=summary,
        primary_issue=primary_issue,
        explanation=explanation,
        recommendations=recommendations,
        next_session_goal=next_session_goal,
        safety_note=SAFETY_DISCLAIMER,
        retrieved_guidance=retrieved_items,
        source="deterministic",
        model=None,
    )


def _call_gemini_llm(
    prompt: str,
    api_key: str,
    model: str = "gemini-2.5-flash",
) -> Any:
    """Calls Gemini REST API with structured JSON output schema."""
    # The key goes in a header, not the URL, so it never appears in URLs that
    # proxies or HTTP client logs may record.
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    headers = {"Content-Type": "application/json", "x-goog-api-key": api_key}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.2,
        },
    }

    try:
        with httpx.Client(timeout=httpx.Timeout(25.0, connect=10.0)) as client:
            resp = client.post(url, headers=headers, json=payload)
            if resp.status_code != 200:
                logger.warning("Gemini API error %d: %s", resp.status_code, resp.text[:300])
                return None
            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                return None
            text = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
            return json.loads(text)
    except Exception as exc:
        logger.warning("LLM request failed, falling back to deterministic: %s", exc)
        return None


def _validate_llm_response(raw: Any) -> dict[str, Any] | None:
    """Validates LLM output as untrusted input. Returns cleaned dict or None on failure."""
    # The model may return any JSON value (an array, a string, ...).
    if not isinstance(raw, dict):
        logger.warning("LLM returned %s instead of a JSON object, rejecting", type(raw).__name__)
        return None
    # primary_issue must be a known rule ID or null
    pi = raw.get("primary_issue")
    if pi is not None and pi not in KNOWN_RULE_IDS:
        logger.warning("LLM returned unknown primary_issue '%s', rejecting", pi)
        return None

    # Recommendations must be 1–3 non-empty strings
    recs = raw.get("recommendations")
    if not isinstance(recs, list) or len(recs) < 1:
        logger.warning("LLM returned invalid recommendations, rejecting")
        return None
    cleaned_recs = [r for r in recs if isinstance(r, str) and r.strip()]
    if len(cleaned_recs) < 1:
        logger.warning("LLM returned empty recommendations, rejecting")
        return None
    cleaned_recs = cleaned_recs[:3]

    # Safety note must be present
    safety = raw.get("safety_note")
    if not isinstance(safety, str) or not safety.strip():
        safety = SAFETY_DISCLAIMER

    # Reject medical diagnoses and guarantees in any text field
    for field in ("summary", "explanation", "next_session_goal"):
        val = raw.get(field, "")
        if isinstance(val, str) and _UNSAFE_PATTERNS.search(val):
            logger.warning("LLM response contains unsafe medical language in '%s', rejecting", field)
            return None
    for rec in cleaned_recs:
        if _UNSAFE_PATTERNS.search(rec):
            logger.warning("LLM recommendation contains unsafe medical language, rejecting")
            return None

    # summary and explanation must be non-empty strings
    summary = raw.get("summary")
    explanation = raw.get("explanation")
    next_goal = raw.get("next_session_goal")
    if not isinstance(summary, str) or not summary.strip():
        return None
    if not isinstance(explanation, str) or not explanation.strip():
        return None
    if not isinstance(next_goal, str) or not next_goal.strip():
        return None

    return {
        "summary": summary,
        "primary_issue": pi,
        "explanation": explanation,
        "recommendations": cleaned_recs,
        "next_session_goal": next_goal,
        "safety_note": safety,
    }


def analyze_session_coaching(
    request: CoachingAnalyzeRequest,
    retriever: BiomechanicsKnowledgeRetriever | None = None,
) -> CoachingAnalyzeResponse:
    """
    Main entrypoint: retrieves guidance and synthesizes schema-validated coaching advice.
    """
    if retriever is None:
        retriever = get_retriever()

    if request.personalized_baseline and request.personalized_baseline.exercise not in (None, request.exercise):
        request.personalized_baseline = None

    # Step 1: Retrieve approved guidance passages
    issue_dicts = [i.model_dump() for i in request.issues]
    metrics_dict = request.metrics.model_dump()
    passages = retriever.retrieve(
        exercise=request.exercise,
        issues=issue_dicts,
        metrics=metrics_dict,
        user_goal=request.user_goal,
        top_k=3,
    )

    retrieved_items = [
        RetrievedGuidanceItem(
            source_id=p.source_id,
            title=p.title,
            relevance_score=p.relevance_score,
            passage=p.passage,
            source_url=p.source_url,
        )
        for p in passages
    ]

    # Step 2: Check for configured LLM
    settings = get_settings()
    api_key = settings.gemini_api_key or os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")

    if api_key:
        guidance_text = "\n\n".join(
            f"[{p.source_id}] {p.title}:\n{p.passage}" for p in retrieved_items
        )
        baseline_data = request.personalized_baseline.model_dump() if request.personalized_baseline else None
        prompt = f"""
You are an expert weightlifting biomechanics coach. You are evaluating structured workout metrics and personalized calibration baselines for a lifter.

RULES:
1. Explain measured results strictly grounded in the approved guidance below.
2. DO NOT diagnose any injury. Conservative coaching only.
3. DO NOT invent metrics or unsupported citations.
4. Provide AT MOST 3 actionable recommendations.
5. Emphasize safety and conservative progression.

RETRIEVED APPROVED GUIDANCE:
{guidance_text}

SESSION SUMMARY DATA:
- Exercise: {request.exercise}
- Form Score: {request.form_score} / 100
- Rep Count: {request.rep_count}
- Issues Detected: {issue_dicts}
- Metrics: {metrics_dict}
- Personalized Baseline: {baseline_data}
- Goal: {request.user_goal or f"Improve {request.exercise.replace('_', ' ')} technique"}

Return a JSON object conforming precisely to:
{{
  "summary": "Concise 1-sentence summary of the set",
  "primary_issue": "primary issue name or null if clean",
  "explanation": "2-3 sentences explaining the biomechanics and relating to the user's baseline",
  "recommendations": ["Recommendation 1", "Recommendation 2", "Recommendation 3"],
  "next_session_goal": "Clear, measurable target for the next workout",
  "safety_note": "{SAFETY_DISCLAIMER}"
}}
"""
        llm_result = _call_gemini_llm(prompt, api_key, settings.coaching_model)
        if llm_result:
            validated = _validate_llm_response(llm_result)
            if validated:
                try:
                    return CoachingAnalyzeResponse(
                        **validated,
                        retrieved_guidance=retrieved_items,
                        source="llm",
                        model=settings.coaching_model,
                    )
                except Exception as exc:
                    logger.warning("LLM response schema validation failed: %s, falling back", exc)
            else:
                logger.warning("LLM response failed validation checks, falling back to deterministic")

    # Step 3: Fallback to deterministic grounded generator
    return _format_deterministic_coaching(request, retrieved_items, passages)

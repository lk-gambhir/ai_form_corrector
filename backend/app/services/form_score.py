"""
Server-side form score computation.

    form_score = 100 * sum_i( w_i * p_i )

where `p_i` is the PASS RATE of rule `i` across all reps in the session
(fraction of reps with NO issue of that `issue_type`/rule id logged against
them), and `w_i` are fixed weights summing to 1.0.

The frontend exercise config and Python exercise score module each declare
score weights. Python cannot import the JavaScript config, so corresponding
`exercises/<id>/config/exercise.config.js` and
`exercises/<id>/backend/scoring.py` values must be kept in sync. The shared
registry below imports the server-owned weights and issue IDs for validation.
"""
from dataclasses import dataclass

from exercises.deadlift.backend.scoring import (
    EXERCISE_ID as DEADLIFT_ID,
    ISSUE_IDS as DEADLIFT_ISSUES,
    SCORE_WEIGHTS as DEADLIFT_WEIGHTS,
)
from exercises.push_up.backend.scoring import (
    EXERCISE_ID as PUSH_UP_ID,
    ISSUE_IDS as PUSH_UP_ISSUES,
    SCORE_WEIGHTS as PUSH_UP_WEIGHTS,
)
from exercises.squat.backend.scoring import (
    EXERCISE_ID as SQUAT_ID,
    ISSUE_IDS as SQUAT_ISSUES,
    SCORE_MEASURED_BY as SQUAT_MEASURED_BY,
    SCORE_WEIGHTS as SQUAT_WEIGHTS,
)

# Must sum to 1.0 per exercise; keep in sync with that exercise's JS config.
SCORE_WEIGHTS_BY_EXERCISE: dict[str, dict[str, float]] = {
    SQUAT_ID: SQUAT_WEIGHTS,
    PUSH_UP_ID: PUSH_UP_WEIGHTS,
    DEADLIFT_ID: DEADLIFT_WEIGHTS,
}
DEFAULT_SCORE_WEIGHTS: dict[str, float] = SCORE_WEIGHTS_BY_EXERCISE["squat"]
ISSUE_IDS_BY_EXERCISE: dict[str, set[str]] = {
    SQUAT_ID: set(SQUAT_ISSUES),
    PUSH_UP_ID: set(PUSH_UP_ISSUES),
    DEADLIFT_ID: set(DEADLIFT_ISSUES),
}


# Rules scored only on reps where they were measured (see compute_form_score).
SCORE_MEASURED_BY_EXERCISE: dict[str, dict[str, str]] = {
    SQUAT_ID: SQUAT_MEASURED_BY,
}


def get_score_weights(exercise: str) -> dict[str, float]:
    return SCORE_WEIGHTS_BY_EXERCISE[exercise]


def get_measured_by(exercise: str) -> dict[str, str]:
    return SCORE_MEASURED_BY_EXERCISE.get(exercise, {})

# +/- points of slack allowed between the client-submitted form_score and the
# server's independent recomputation before we reject the session as
# untrusted/inconsistent.
SCORE_TOLERANCE = 2.0


@dataclass
class RepLike:
    rep_number: int


@dataclass
class IssueLike:
    rep_number: int
    issue_type: str


def _field(obj, name: str, default=None):
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def compute_form_score(
    reps: list,
    form_issues: list,
    weights: dict[str, float] | None = None,
    measured_by: dict[str, str] | None = None,
) -> float:
    """Recompute the 0-100 form score from rep + issue records.

    `reps` / `form_issues` may be ORM rows, Pydantic models, or any object
    exposing `.rep_number` (and `.issue_type` for issues) — duck-typed so the
    same function works against request payloads and DB rows.

    `measured_by` maps a rule to the `angle_metrics` key that shows it was
    measured on a rep. Such a rule's pass rate uses only reps where it was
    measured (metric present, or an issue was logged for it); a rule measured
    on no rep is left out and the remaining weights are rescaled.
    """
    weights = DEFAULT_SCORE_WEIGHTS if weights is None else weights
    measured_by = measured_by or {}
    total_reps = len(reps)

    if total_reps == 0:
        # Standalone callers may ask for a score before reps exist; persisted
        # session requests require at least one rep in the request schema.
        return 100.0

    failing_rep_numbers_by_rule: dict[str, set[int]] = {rule: set() for rule in weights}
    for issue in form_issues:
        rule = issue.issue_type if hasattr(issue, "issue_type") else issue["issue_type"]
        rep_number = issue.rep_number if hasattr(issue, "rep_number") else issue["rep_number"]
        if rule in failing_rep_numbers_by_rule:
            failing_rep_numbers_by_rule[rule].add(rep_number)

    score = 0.0
    used_weight = 0.0
    for rule, weight in weights.items():
        failing = failing_rep_numbers_by_rule[rule]
        considered = total_reps
        metric = measured_by.get(rule)
        if metric:
            measured = set(failing)
            for rep in reps:
                angle_metrics = _field(rep, "angle_metrics") or {}
                if metric in angle_metrics:
                    measured.add(_field(rep, "rep_number"))
            considered = len(measured)
            if considered == 0:
                continue
        score += weight * (considered - len(failing)) / considered
        used_weight += weight

    if used_weight == 0:
        return 100.0
    return round(score / used_weight * 100, 4)


def is_within_tolerance(
    client_score: float,
    reps: list,
    form_issues: list,
    weights: dict[str, float] | None = None,
    tolerance: float = SCORE_TOLERANCE,
    measured_by: dict[str, str] | None = None,
) -> tuple[bool, float]:
    """Returns (ok, server_computed_score)."""
    server_score = compute_form_score(reps, form_issues, weights, measured_by)
    return abs(client_score - server_score) <= tolerance, server_score

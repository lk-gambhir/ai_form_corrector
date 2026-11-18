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


def get_score_weights(exercise: str) -> dict[str, float]:
    return SCORE_WEIGHTS_BY_EXERCISE[exercise]

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


def compute_form_score(
    reps: list,
    form_issues: list,
    weights: dict[str, float] | None = None,
) -> float:
    """Recompute the 0-100 form score from rep + issue records.

    `reps` / `form_issues` may be ORM rows, Pydantic models, or any object
    exposing `.rep_number` (and `.issue_type` for issues) — duck-typed so the
    same function works against request payloads and DB rows.
    """
    weights = DEFAULT_SCORE_WEIGHTS if weights is None else weights
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
    for rule, weight in weights.items():
        failed = len(failing_rep_numbers_by_rule[rule])
        pass_rate = (total_reps - failed) / total_reps
        score += weight * pass_rate

    return round(score * 100, 4)


def is_within_tolerance(
    client_score: float,
    reps: list,
    form_issues: list,
    weights: dict[str, float] | None = None,
    tolerance: float = SCORE_TOLERANCE,
) -> tuple[bool, float]:
    """Returns (ok, server_computed_score)."""
    server_score = compute_form_score(reps, form_issues, weights)
    return abs(client_score - server_score) <= tolerance, server_score

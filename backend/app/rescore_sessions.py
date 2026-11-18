"""
Recompute stored session form scores with the current scoring rules.

Why: squat sessions saved before view-aware scoring passed knee valgus, torso
lean and tempo on every rep (those checks were never measured), so their
scores are inflated compared with sessions saved now. This recomputes every
stored session's form_score from its stored reps and issues using the current
weights and `SCORE_MEASURED_BY` rules:

- Old squat reps have no `kneeAnkleRatio` / `torsoLeanMaxDeg` in angle_metrics,
  so knee valgus and torso lean count as "not measured" and drop out; the
  score is rebuilt from depth and tempo (weights rescaled to sum to 1).
- Push-up and deadlift scores are recomputed from their stored issues and
  normally do not change.

It never re-evaluates the form rules (raw angles are not stored), so it cannot
add issues that old versions failed to detect.

Usage (from backend/, with the venv active):
    PYTHONPATH=.. python -m app.rescore_sessions          # dry run: report only
    PYTHONPATH=.. python -m app.rescore_sessions --apply  # write new scores
"""
import argparse

from sqlalchemy.orm import Session as DBSession, selectinload

from app.database import SessionLocal
from app.models import Session as SessionModel
from app.services.form_score import compute_form_score, get_measured_by, get_score_weights


def rescore(db: DBSession, apply: bool) -> list[tuple[str, str, float, float]]:
    """Returns (session_id, exercise, old_score, new_score) for changed sessions."""
    changed = []
    sessions = (
        db.query(SessionModel)
        .options(selectinload(SessionModel.reps), selectinload(SessionModel.form_issues))
        .all()
    )
    for session in sessions:
        new_score = compute_form_score(
            session.reps,
            session.form_issues,
            weights=get_score_weights(session.exercise),
            measured_by=get_measured_by(session.exercise),
        )
        if abs(new_score - session.form_score) > 1e-6:
            changed.append((session.id, session.exercise, session.form_score, new_score))
            if apply:
                session.form_score = new_score
    if apply:
        db.commit()
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--apply", action="store_true", help="write the new scores (default: dry run)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        changed = rescore(db, apply=args.apply)
    finally:
        db.close()

    for session_id, exercise, old, new in changed:
        print(f"{session_id}  {exercise:9}  {old:7.2f} -> {new:7.2f}")
    verb = "Updated" if args.apply else "Would update"
    print(f"{verb} {len(changed)} session(s).")
    if changed and not args.apply:
        print("Run again with --apply to write these scores.")


if __name__ == "__main__":
    main()

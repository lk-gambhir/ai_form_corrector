from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import User
from app.schemas import CoachingAnalyzeRequest, CoachingAnalyzeResponse, CoachingBaselineIn
from app.security import decode_access_token, oauth2_scheme
from app.rate_limit import coaching_rate_limiter, rate_limit_key
from app.services.coaching import analyze_session_coaching
from app.routers.calibration import get_user_exercise_profile

router = APIRouter(prefix="/api/coaching", tags=["coaching"])


def get_optional_user(
    token: str | None = Depends(oauth2_scheme),
    db: DBSession = Depends(get_db),
) -> User | None:
    """Extracts user if bearer token provided; returns None otherwise."""
    if not token:
        return None
    try:
        user_id = decode_access_token(token)
        return db.get(User, user_id)
    except HTTPException:
        raise


@router.post("/analyze", response_model=CoachingAnalyzeResponse)
def analyze_workout(
    payload: CoachingAnalyzeRequest,
    request: Request,
    current_user: User | None = Depends(get_optional_user),
    db: DBSession = Depends(get_db),
):
    """
    Evidence-grounded AI coaching analysis for a completed exercise set.
    Combines measured kinematics, user baseline calibration, and retrieved
    approved guidance to generate a schema-validated coaching breakdown.
    """
    coaching_rate_limiter.check(rate_limit_key(request, current_user.id if current_user else None))

    # If athlete is logged in and baseline not provided in payload, inject from DB
    if current_user and not payload.personalized_baseline:
        profile = get_user_exercise_profile(db, current_user.id, payload.exercise)
        if profile:
            lr = profile.get("limb_ratios", {})
            rom = profile.get("rom", {})
            stats = profile.get("angle_stats", {})
            payload.personalized_baseline = CoachingBaselineIn(
                exercise=payload.exercise,
                exercise_metrics=rom,
                femur_to_torso=lr.get("femurToTorso") or lr.get("femur_to_torso"),
                shin_to_torso=lr.get("shinToTorso") or lr.get("shin_to_torso"),
                knee_bottom_angle=rom.get("kneeBottom") or rom.get("knee_bottom"),
                typical_torso_lean=(
                    stats.get("typical_torso_lean")
                    or rom.get("typicalTorsoLean")
                ),
                confidence=0.95,
            )

    return analyze_session_coaching(payload)

"""USER_BASELINE upsert/fetch — the Week-7 personalization baseline."""
from copy import deepcopy
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import User, UserBaseline
from app.schemas import BaselineIn, BaselineOut
from app.security import get_current_user

router = APIRouter(prefix="/api/calibration", tags=["calibration"])


@router.post("", response_model=BaselineOut)
def upsert_calibration(
    payload: BaselineIn,
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    baseline = db.query(UserBaseline).filter(UserBaseline.user_id == current_user.id).first()
    if baseline is None:
        baseline = UserBaseline(user_id=current_user.id)
        db.add(baseline)

    profiles = deepcopy(_profiles(baseline))
    profiles[payload.exercise] = {
        "limb_ratios": payload.limb_ratios,
        "rom": payload.rom,
        "angle_stats": payload.angle_stats,
    }
    baseline.limb_ratios = {"profiles": profiles}
    baseline.rom = {}
    baseline.angle_stats = {}
    calibrated_at = datetime.now(timezone.utc)
    profiles[payload.exercise]["calibrated_at"] = calibrated_at.isoformat()
    baseline.calibrated_at = calibrated_at

    db.commit()
    db.refresh(baseline)
    return _profile_out(baseline, payload.exercise)


@router.get("", response_model=BaselineOut)
def get_calibration(
    exercise: str = "squat",
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if exercise not in {"squat", "push_up", "deadlift"}:
        raise HTTPException(status_code=400, detail="unsupported exercise")
    baseline = db.query(UserBaseline).filter(UserBaseline.user_id == current_user.id).first()
    if baseline is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No calibration baseline found")
    profile = _profiles(baseline).get(exercise)
    if profile is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No calibration baseline found")
    return _profile_out(baseline, exercise)


def _profiles(baseline: UserBaseline) -> dict:
    ratios = baseline.limb_ratios or {}
    profiles = ratios.get("profiles")
    if profiles is not None:
        return profiles
    # Preserve existing flat rows as the user's legacy Squat profile.
    if ratios or baseline.rom or baseline.angle_stats:
        return {"squat": {"limb_ratios": ratios, "rom": baseline.rom or {}, "angle_stats": baseline.angle_stats or {}}}
    return {}


def get_user_exercise_profile(db: DBSession, user_id: str, exercise: str) -> dict | None:
    baseline = db.query(UserBaseline).filter(UserBaseline.user_id == user_id).first()
    if baseline is None:
        return None
    profile = _profiles(baseline).get(exercise)
    return profile


def _profile_out(baseline: UserBaseline, exercise: str) -> dict:
    profile = _profiles(baseline)[exercise]
    return {
        "exercise": exercise,
        **profile,
        "calibrated_at": profile.get("calibrated_at", baseline.calibrated_at),
    }

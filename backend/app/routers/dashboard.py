"""Per-user dashboard summary + trends. Always scoped to the current JWT user."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session as DBSession

from app.database import get_db
from app.models import Session as SessionModel, User
from app.schemas import DashboardSummaryResponse, DashboardTrendsResponse
from app.security import get_current_user
from app.services.aggregation import compute_summary, compute_trend_points
from app.services.form_score import SCORE_WEIGHTS_BY_EXERCISE

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

VALID_METRICS = {"form_score", "rom", "tempo", "reps"}


def _user_sessions(db: DBSession, user_id: str, exercise: str | None = None) -> list[SessionModel]:
    query = db.query(SessionModel).filter(SessionModel.user_id == user_id)
    if exercise:
        query = query.filter(SessionModel.exercise == exercise)
    return query.all()


@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary(
    exercise: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if exercise is not None and exercise not in SCORE_WEIGHTS_BY_EXERCISE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="unsupported exercise")
    sessions = _user_sessions(db, current_user.id, exercise)
    return compute_summary(sessions)


@router.get("/trends", response_model=DashboardTrendsResponse)
def dashboard_trends(
    metric: str = Query(...),
    exercise: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: DBSession = Depends(get_db),
):
    if metric not in VALID_METRICS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"metric must be one of {sorted(VALID_METRICS)}",
        )
    if exercise is not None and exercise not in SCORE_WEIGHTS_BY_EXERCISE:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="unsupported exercise")

    sessions = _user_sessions(db, current_user.id, exercise)
    points = compute_trend_points(sessions, metric)
    return {"metric": metric, "points": points}

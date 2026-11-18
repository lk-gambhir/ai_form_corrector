"""
Pydantic request/response models.

Field-name mapping to `shared/exercise-config/types.js` (frontend is
camelCase; wire/DB is snake_case — decided since the frontend team hasn't
locked wire casing yet and Python convention is snake_case):

  RepMetrics      repNumber      -> rep_number
                  durationSeconds-> duration_seconds
                  romValue       -> rom_value
                  tempo          -> tempo            (unchanged)
                  angleMetrics   -> angle_metrics

  IssueRecord     repNumber      -> rep_number
                  issueType      -> issue_type
                  severity       -> severity         (unchanged)

  SessionSummary  exercise       -> exercise          (unchanged)
                  startedAt      -> started_at
                  endedAt        -> ended_at
                  durationSeconds-> duration_seconds
                  repCount       -> rep_count
                  formScore      -> form_score
                  reps           -> reps              (list of RepMetrics)
                  formIssues     -> form_issues        (list of IssueRecord)

  UserBaseline    limbRatios     -> limb_ratios  ({femurToTorso, shinToTorso})
                  rom            -> rom           ({kneeStanding, kneeBottom, ...})
                  angleStats     -> angle_stats   (Record<str, {mean,std}>)
                  calibratedAt   -> calibrated_at

Decisions made where types.js was ambiguous for the wire/DB shape:
  - `limb_ratios` / `rom` / `angle_stats` are typed here as `dict` (not fully
    expanded sub-models) since types.js itself leaves their inner value types
    loose (Record<string, ...>) and the frontend may add keys; we pass them
    through opaquely and store as JSON. This avoids a schema migration if the
    frontend adds a ratio/stat key later.
  - `RuleId`/`Severity` are validated as open `str` values at the Pydantic
    field boundary. Session validation then checks each issue ID against the
    selected exercise's server-side catalog in `exercises/<id>/backend/`.
    This keeps the wire shape extensible while rejecting cross-exercise rules.
"""
from datetime import datetime, timezone

from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str | None = None
    display_name: str | None = None
    created_at: datetime


class OAuthResponse(BaseModel):
    user: UserResponse
    access_token: str
    token_type: str = "bearer"


class GoogleAuthRequest(BaseModel):
    token: str = Field(min_length=20)
    email: EmailStr | None = None
    name: str | None = None
    picture: str | None = None


# ---------------------------------------------------------------------------
# Sessions
# ---------------------------------------------------------------------------

class RepMetricsIn(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    rep_number: int
    duration_seconds: float = Field(ge=0)
    rom_value: float = Field(ge=0, le=180)
    tempo: float = Field(ge=0)
    angle_metrics: dict[str, float] = Field(default_factory=dict)


class RepMetricsOut(RepMetricsIn):
    model_config = ConfigDict(from_attributes=True)


class IssueRecordIn(BaseModel):
    rep_number: int
    issue_type: str
    severity: str

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v: str) -> str:
        allowed = {"low", "medium", "high"}
        if v not in allowed:
            raise ValueError(f"severity must be one of {sorted(allowed)}")
        return v


class IssueRecordOut(IssueRecordIn):
    model_config = ConfigDict(from_attributes=True)


class SessionCreateRequest(BaseModel):
    exercise: Literal["squat", "push_up", "deadlift"]
    started_at: datetime
    ended_at: datetime
    duration_seconds: float = Field(ge=0)
    rep_count: int = Field(ge=1)
    form_score: float = Field(ge=0, le=100)
    reps: list[RepMetricsIn] = Field(default_factory=list)
    form_issues: list[IssueRecordIn] = Field(default_factory=list)

    @field_validator("started_at", "ended_at")
    @classmethod
    def assume_utc_when_naive(cls, v: datetime) -> datetime:
        # Mixing a naive and an aware timestamp made the started/ended
        # comparison raise TypeError (HTTP 500). Treat naive values as UTC.
        return v if v.tzinfo is not None else v.replace(tzinfo=timezone.utc)


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    exercise: str
    started_at: datetime
    ended_at: datetime
    duration_seconds: float
    rep_count: int
    form_score: float
    created_at: datetime
    reps: list[RepMetricsOut] = Field(default_factory=list)
    form_issues: list[IssueRecordOut] = Field(default_factory=list)


class SessionListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    exercise: str
    started_at: datetime
    ended_at: datetime
    duration_seconds: float
    rep_count: int
    form_score: float
    created_at: datetime


# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------

class ImprovementBlock(BaseModel):
    direction: str  # "up" | "down" | "flat"
    delta: float
    window: int


class CommonIssue(BaseModel):
    issue_type: str
    count: int


class DashboardSummaryResponse(BaseModel):
    total_sessions: int
    total_reps: int
    best_form_score: float | None
    recent_form_score: float | None
    avg_form_score: float | None
    avg_rom: float | None
    avg_tempo: float | None
    improvement: ImprovementBlock
    most_common_issues: list[CommonIssue]


class TrendPoint(BaseModel):
    date: datetime
    value: float


class DashboardTrendsResponse(BaseModel):
    metric: str
    points: list[TrendPoint]


# ---------------------------------------------------------------------------
# Calibration (USER_BASELINE)
# ---------------------------------------------------------------------------

class BaselineIn(BaseModel):
    exercise: Literal["squat", "push_up", "deadlift"] = "squat"
    limb_ratios: dict = Field(default_factory=dict)
    rom: dict = Field(default_factory=dict)
    angle_stats: dict = Field(default_factory=dict)


class BaselineOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    exercise: Literal["squat", "push_up", "deadlift"]
    limb_ratios: dict
    rom: dict
    angle_stats: dict
    calibrated_at: datetime


# ---------------------------------------------------------------------------
# AI Coaching (RAG Workflow)
# ---------------------------------------------------------------------------

class CoachingIssueIn(BaseModel):
    type: str
    count: int = Field(default=1, ge=1)
    severity: str = Field(default="medium")


class CoachingMetricsIn(BaseModel):
    average_rom: float | None = None
    average_tempo: float | None = None
    rep_duration: float | None = None


class CoachingBaselineIn(BaseModel):
    exercise: str | None = None
    exercise_metrics: dict = Field(default_factory=dict)
    knee_bottom_angle: float | None = None
    typical_torso_lean: float | None = None
    femur_to_torso: float | None = None
    shin_to_torso: float | None = None
    confidence: float | None = None


class CoachingAnalyzeRequest(BaseModel):
    exercise: str = "squat"
    form_score: float = Field(ge=0, le=100)
    rep_count: int = Field(ge=0)
    issues: list[CoachingIssueIn] = Field(default_factory=list)
    metrics: CoachingMetricsIn = Field(default_factory=CoachingMetricsIn)
    personalized_baseline: CoachingBaselineIn | None = None
    user_goal: str | None = None


class RetrievedGuidanceItem(BaseModel):
    source_id: str
    title: str
    relevance_score: float
    passage: str
    source_url: str | None = None


class CoachingAnalyzeResponse(BaseModel):
    summary: str = Field(min_length=1)
    primary_issue: str | None = None
    explanation: str = Field(min_length=1)
    recommendations: list[str] = Field(max_length=3)
    next_session_goal: str = Field(min_length=1)
    safety_note: str = Field(min_length=1)
    retrieved_guidance: list[RetrievedGuidanceItem] = Field(default_factory=list)
    source: Literal["llm", "deterministic"] = "deterministic"
    model: str | None = None

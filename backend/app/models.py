"""
SQLAlchemy ORM models.

- All primary keys are TEXT holding a `uuid4` string (portable to Postgres —
  swap to native UUID type later if desired, no schema redesign needed).
- `JSON` columns are SQLAlchemy's generic `JSON` type, which SQLite stores as
  serialized TEXT transparently; Postgres would use native JSONB with zero
  code changes.
- No video/image column anywhere in this schema, by design (see PRD/spec:
  the backend never receives or stores frames).
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Float, ForeignKey, Index, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TypeDecorator

from app.database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class UTCDateTime(TypeDecorator):
    """Timezone-safe datetime column.

    SQLite has no timezone support: a plain `DateTime` silently drops the
    offset, and values come back naive, so the API returned
    "2026-11-18T10:00:00" (no "Z") and browsers parsed it as *local* time.
    This type converts aware values to UTC before storing and marks values
    read back as UTC, so responses serialize with an explicit "Z". Naive
    input is assumed to already be UTC (which is what existing rows hold,
    since the frontend always sends toISOString()).
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


class User(Base):
    __tablename__ = "user"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    username: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    email: Mapped[str | None] = mapped_column(String, unique=True, nullable=True, index=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=_utcnow)

    sessions: Mapped[list["Session"]] = relationship(back_populates="user", cascade="all, delete-orphan")
    baseline: Mapped["UserBaseline | None"] = relationship(back_populates="user", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "session"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("user.id"), nullable=False)
    exercise: Mapped[str] = mapped_column(String, nullable=False)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    ended_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    rep_count: Mapped[int] = mapped_column(Integer, nullable=False)
    form_score: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="sessions")
    reps: Mapped[list["Rep"]] = relationship(back_populates="session", cascade="all, delete-orphan")
    form_issues: Mapped[list["FormIssue"]] = relationship(back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_session_user_id_started_at", "user_id", "started_at"),
    )


class Rep(Base):
    __tablename__ = "rep"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("session.id"), nullable=False)
    rep_number: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_seconds: Mapped[float] = mapped_column(Float, nullable=False)
    rom_value: Mapped[float] = mapped_column(Float, nullable=False)
    tempo: Mapped[float] = mapped_column(Float, nullable=False)
    angle_metrics: Mapped[dict] = mapped_column(JSON, default=dict)

    session: Mapped["Session"] = relationship(back_populates="reps")

    __table_args__ = (
        Index("ix_rep_session_id", "session_id"),
    )


class FormIssue(Base):
    __tablename__ = "form_issue"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    session_id: Mapped[str] = mapped_column(String, ForeignKey("session.id"), nullable=False)
    rep_number: Mapped[int] = mapped_column(Integer, nullable=False)
    issue_type: Mapped[str] = mapped_column(String, nullable=False)
    severity: Mapped[str] = mapped_column(String, nullable=False)

    session: Mapped["Session"] = relationship(back_populates="form_issues")

    __table_args__ = (
        Index("ix_form_issue_session_id", "session_id"),
    )


class UserBaseline(Base):
    """Week-7 personalization baseline. One row per user (upserted)."""

    __tablename__ = "user_baseline"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(String, ForeignKey("user.id"), unique=True, nullable=False)
    limb_ratios: Mapped[dict] = mapped_column(JSON, default=dict)
    rom: Mapped[dict] = mapped_column(JSON, default=dict)
    angle_stats: Mapped[dict] = mapped_column(JSON, default=dict)
    calibrated_at: Mapped[datetime] = mapped_column(UTCDateTime, default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="baseline")

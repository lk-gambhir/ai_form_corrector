"""Regression tests for the code-review fixes.

Self-contained: builds its own in-memory database and overrides `get_db`, so
it does not depend on (or clash with) any other local conftest fixtures.
Google token verification is monkeypatched, so no network access is needed.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings, get_settings
from app.database import Base, get_db
from app.knowledge.retriever import BiomechanicsKnowledgeRetriever
from app.main import app
from app.models import Session as SessionModel
from app.rate_limit import InMemoryRateLimiter, coaching_rate_limiter
from app.rescore_sessions import rescore
from app.routers import auth as auth_router
from app.services import coaching
from app.services.form_score import compute_form_score, get_measured_by, get_score_weights


@pytest.fixture
def db_factory():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


@pytest.fixture
def client(db_factory, monkeypatch):
    monkeypatch.setenv("APP_ENVIRONMENT", "test")
    monkeypatch.setenv("APP_ALLOW_INSECURE_TEST_TOKENS", "true")
    monkeypatch.setenv("APP_GOOGLE_CLIENT_ID", "test-client.apps.googleusercontent.com")
    get_settings.cache_clear()

    def override_db():
        db = db_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_db
    coaching_rate_limiter.clear()
    yield TestClient(app, raise_server_exceptions=False)
    app.dependency_overrides.clear()
    get_settings.cache_clear()


def login(client, email="athlete@example.com"):
    r = client.post("/api/auth/google", json={"token": "test-token-for-tests-only", "email": email})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def squat_session(score, reps, issues=(), started="2026-11-18T10:00:00Z", ended="2026-11-18T10:01:00Z"):
    return {
        "exercise": "squat", "started_at": started, "ended_at": ended, "duration_seconds": 60,
        "rep_count": len(reps), "form_score": score,
        "reps": [
            {"rep_number": i + 1, "duration_seconds": 2, "rom_value": 80, "tempo": 1, "angle_metrics": m}
            for i, m in enumerate(reps)
        ],
        "form_issues": [{"rep_number": n, "issue_type": t, "severity": "medium"} for n, t in issues],
    }


# --- auth -------------------------------------------------------------------

def test_fake_tokens_need_the_explicit_flag(client, monkeypatch):
    monkeypatch.setenv("APP_ALLOW_INSECURE_TEST_TOKENS", "false")
    get_settings.cache_clear()

    def reject(*_args, **_kwargs):
        raise ValueError("not a Google token")

    monkeypatch.setattr(auth_router.id_token, "verify_oauth2_token", reject)
    r = client.post("/api/auth/google", json={"token": "test-token-for-tests-only", "email": "victim@example.com"})
    assert r.status_code == 401


def test_test_token_flag_is_refused_outside_test_environment():
    with pytest.raises(ValueError):
        Settings(environment="development", allow_insecure_test_tokens=True)


def test_real_login_requires_verified_email_and_ignores_body_email(client, monkeypatch):
    monkeypatch.setenv("APP_ALLOW_INSECURE_TEST_TOKENS", "false")
    get_settings.cache_clear()
    claims = {"email": "real@example.com", "email_verified": False, "name": "Real"}
    monkeypatch.setattr(auth_router.id_token, "verify_oauth2_token", lambda *a, **k: dict(claims))
    token = "eyJ-a-real-looking-google-id-token"
    assert client.post("/api/auth/google", json={"token": token}).status_code == 401

    claims["email_verified"] = True
    r = client.post("/api/auth/google", json={"token": token, "email": "attacker@example.com"})
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "real@example.com"


# --- timestamps -------------------------------------------------------------

def test_timestamps_are_returned_in_utc(client):
    headers = login(client)
    body = squat_session(100, [{}], started="2026-11-18T15:30:00+05:30")
    r = client.post("/api/sessions", json=body, headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["started_at"] == "2026-11-18T10:00:00Z"
    assert client.get("/api/sessions", headers=headers).json()[0]["started_at"].endswith("Z")


def test_mixed_naive_and_aware_timestamps_do_not_crash(client):
    headers = login(client)
    body = squat_session(100, [{}], started="2026-11-18T10:00:00")
    assert client.post("/api/sessions", json=body, headers=headers).status_code == 201


# --- view-aware squat scoring -----------------------------------------------

def test_unmeasured_rules_are_left_out_of_the_squat_score():
    weights, measured_by = get_score_weights("squat"), get_measured_by("squat")
    reps = [{"rep_number": 1, "angle_metrics": {}}, {"rep_number": 2, "angle_metrics": {}}]
    issues = [{"rep_number": 1, "issue_type": "depth"}]
    # valgus and lean unmeasured: depth .35 (pass rate .5) + tempo .15, over .5
    assert compute_form_score(reps, issues, weights, measured_by) == pytest.approx((0.35 * 0.5 + 0.15) / 0.5 * 100)
    # without measured_by every rule counts (the old, inflated behaviour)
    assert compute_form_score(reps, issues, weights) == pytest.approx(82.5)


def test_server_accepts_the_client_view_aware_score(client):
    headers = login(client)
    reps = [{"kneeAnkleRatio": 0.6}, {"kneeAnkleRatio": 1.1}]
    expected = (0.35 + 0.25 * 0.5 + 0.15) / 0.75 * 100
    body = squat_session(round(expected, 2), reps, issues=[(1, "knee_valgus")])
    r = client.post("/api/sessions", json=body, headers=headers)
    assert r.status_code == 201, r.text
    assert r.json()["form_score"] == pytest.approx(expected, abs=1e-3)


def test_rescore_recomputes_old_inflated_scores(client, db_factory):
    headers = login(client)
    # A session with no view metrics. The server now rejects the old inflated
    # score (82.5) and stores 65; then the old score is written back to
    # simulate a session saved before view-aware scoring.
    assert client.post("/api/sessions", json=squat_session(82.5, [{}, {}], issues=[(1, "depth")]), headers=headers).status_code == 422
    body = squat_session(65.0, [{}, {}], issues=[(1, "depth")])
    db = db_factory()
    try:
        r = client.post("/api/sessions", json=body, headers=headers)
        assert r.status_code == 201
        db.query(SessionModel).update({SessionModel.form_score: 82.5})
        db.commit()
        changed = rescore(db, apply=True)
        assert len(changed) == 1
        assert db.query(SessionModel).one().form_score == pytest.approx(65.0)
        assert rescore(db, apply=True) == []  # idempotent
    finally:
        db.close()


# --- coaching ---------------------------------------------------------------

@pytest.mark.parametrize("text", ["a diagnosis", "you are diagnosed", "guaranteed results", "two fractures", "needs surgery"])
def test_unsafe_language_filter_catches_word_forms(text):
    assert coaching._UNSAFE_PATTERNS.search(text)


def test_llm_json_array_is_rejected_not_crashing():
    assert coaching._validate_llm_response(["not", "an", "object"]) is None


def test_retriever_keeps_keywords_as_separate_tokens():
    retriever = BiomechanicsKnowledgeRetriever()
    assert "paralleldepth" not in retriever.idf
    assert "depth" in retriever.idf


def test_gemini_key_is_sent_in_a_header(monkeypatch):
    captured = {}

    class FakeResponse:
        status_code = 200
        text = ""

        @staticmethod
        def json():
            return {"candidates": [{"content": {"parts": [{"text": "{}"}]}}]}

    class FakeClient:
        def __init__(self, *a, **k):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def post(self, url, headers=None, json=None):
            captured["url"], captured["headers"] = url, headers
            return FakeResponse()

    monkeypatch.setattr(coaching.httpx, "Client", FakeClient)
    coaching._call_gemini_llm("prompt", "secret-key")
    assert "secret-key" not in captured["url"]
    assert captured["headers"]["x-goog-api-key"] == "secret-key"


def test_rate_limiter_drops_idle_keys_and_limits_per_key():
    limiter = InMemoryRateLimiter(limit=2, window_seconds=1)
    limiter.check("user:a")
    limiter.check("user:a")
    with pytest.raises(Exception):
        limiter.check("user:a")
    limiter.check("user:b")  # a different user is not affected
    limiter._events["user:a"].clear()
    limiter._prune("user:a", cutoff=0)
    assert "user:a" not in limiter._events

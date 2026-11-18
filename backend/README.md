# Backend — FormGuard AI API

FastAPI + SQLite backend: auth, session storage, dashboard aggregation, and
calibration baselines for the activity-based app. Session creation accepts
Squat, Push-up, and Deadlift with exercise-specific issue validation and score
weights. Receives only numeric/structured session summaries from the frontend
— **no video or image data reaches this service.**

## Setup

Requires Python 3.11+ (developed/tested on 3.13).

```bash
cd backend
python3.13 -m venv .venv        # or your Python 3.11+ interpreter
.venv/bin/pip install -r requirements.txt
```

## Run

```bash
cd backend
PYTHONPATH=.. .venv/bin/uvicorn app.main:app --reload --port 8000
```

- API base: `http://localhost:8000/api`
- Interactive docs (Swagger UI): `http://localhost:8000/docs`
- SQLite file is created at `backend/data/app.db` on first run (gitignored).
- CORS is restricted to the Vite dev origin `http://localhost:5173` by
  default (see `app/config.py` / `APP_CORS_ORIGINS` env var).

From the repo root, `npm run dev:backend` / `npm run test:backend` run the
equivalent commands (see root `package.json`) — they assume the venv above
already exists at `backend/.venv`.

## Configuration

All settings are read via `pydantic-settings` from environment variables
prefixed `APP_`, or a `backend/.env` file (gitignored). Key ones:

| Env var                | Default                     | Purpose                          |
|-------------------------|------------------------------|-----------------------------------|
| `APP_DATABASE_URL`      | `sqlite:///./data/app.db`   | SQLAlchemy URL (swap dialect for Postgres later) |
| `APP_JWT_SECRET`        | dev-only insecure default   | **Override in any shared/deployed env** |
| `APP_JWT_ALGORITHM`     | `HS256`                     | JWT signing algorithm            |
| `APP_JWT_EXPIRE_MINUTES`| `1440` (24h)                 | Token lifetime                   |
| `APP_CORS_ORIGINS`      | `["http://localhost:5173"]` | Allowed frontend origins         |
| `APP_GOOGLE_CLIENT_ID`  | empty                       | Google OAuth web client ID (required for sign-in) |
| `APP_ENVIRONMENT`       | `development`               | `development`, `test` or `production` |
| `APP_ALLOW_INSECURE_TEST_TOKENS` | `false`            | Accept fake test tokens; only allowed with `APP_ENVIRONMENT=test` |
| `APP_GEMINI_API_KEY`    | empty                       | Enables LLM coaching (otherwise deterministic) |
| `APP_COACHING_MODEL`    | `gemini-2.5-flash`          | Gemini model for coaching        |

## Tests

```bash
cd backend
PYTHONPATH=.. .venv/bin/pytest          # or: PYTHONPATH=.. .venv/bin/pytest -q
```

`app/tests/test_review_fixes.py` builds its own in-memory SQLite database
and overrides the `get_db` dependency, so it never touches
`backend/data/app.db`. If you keep other tests locally (the repo previously
ignored `app/tests/`), commit them as well.

## Layout

```
app/
  main.py          FastAPI app, CORS, router wiring, table creation on startup
  config.py        pydantic-settings (DB url, JWT secret/expiry, CORS origins)
  database.py      SQLAlchemy engine/session, Base, get_db dependency
  security.py      JWT create/decode, get_current_user
  models.py        SQLAlchemy models: User, Session, Rep, FormIssue, UserBaseline
  schemas.py       Pydantic request/response models (+ types.js field mapping)
  routers/
    auth.py        POST /api/auth/google (Google sign-in), GET /api/auth/me
    sessions.py    POST/GET /api/sessions, GET /api/sessions/{id}
    dashboard.py   GET /api/dashboard/summary, /api/dashboard/trends
    calibration.py POST/GET /api/calibration
    coaching.py    POST /api/coaching/analyze (RAG coaching, rate-limited)
    health.py      GET /api/health
  services/
    validation.py  Cross-field session payload validation
    form_score.py  Server-side form_score recompute + tolerance check
    aggregation.py Dashboard summary/trends/improvement math
  rescore_sessions.py  Recompute stored form scores with current rules
  tests/
    test_review_fixes.py  auth, timestamps, view-aware scoring, coaching
exercises/
  squat/backend/scoring.py       Squat score weights and issue IDs
  push_up/backend/scoring.py     Push-up score weights and issue IDs
  deadlift/backend/scoring.py    Deadlift score weights and issue IDs
```

## Data contract with the frontend

Request/response field names are snake_case mirrors of the camelCase
typedefs in `shared/exercise-config/types.js` (`SessionSummary`,
`RepMetrics`, `IssueRecord`, `UserBaseline`) — see the mapping table and
design notes at the top of `app/schemas.py`.

## Security model

- Sign-in is Google-only: `POST /api/auth/google` verifies the Google ID
  token's signature, audience and `email_verified`, and takes the email only
  from the verified token. There are no passwords; OAuth accounts store a
  placeholder that cannot be used to log in.
- Fake test tokens (`test-*`, `mock-*`, `google-*`) are accepted only when
  BOTH `APP_ENVIRONMENT=test` and `APP_ALLOW_INSECURE_TEST_TOKENS=true` are
  set; the app refuses to start with that flag in any other environment.
- Every protected route depends on `get_current_user` (`app/security.py`),
  which decodes the JWT bearer token and loads the `User` row. Routers pass
  `current_user.id` into every query's `WHERE user_id = ...` filter — the
  request body/query string are never trusted for `user_id`. See
  `app/routers/sessions.py`, `dashboard.py`, `calibration.py`.
- Ownership violations (reading/mutating another user's data) return the
  same `404` as a nonexistent resource, never a `403` that would leak
  existence.

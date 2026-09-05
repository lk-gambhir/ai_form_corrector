# Squat Form Analyzer

A webcam-based squat **form-analysis** web app. Your browser captures video, runs
**MediaPipe Pose** entirely on-device (no video ever leaves your machine), counts
reps, checks your technique against geometric rules, gives one clear cue at a time,
and tracks your progress over sessions.

> ⚠️ **Not a medical device.** This is a heuristic training-feedback tool, not a
> diagnostic or injury-prevention system. See `PRD` for scope and limitations.

This repo is being built as a **simulated multi-week project** (see `journals/`),
one exercise (**Squat**) built deep, with the architecture kept modular so more
exercises can be added later. Stack: **React + Vite (JavaScript)**, **MediaPipe
Tasks Vision**, **FastAPI + SQLite**, tests via **Vitest / Playwright / pytest**.

## Layout
```
shared/exercise-config/   exercise config + shared JSDoc types (the extensibility linchpin)
frontend/                 React (JS) app: pose pipeline, live UI, dashboard
backend/                  FastAPI + SQLite (auth, sessions, dashboard) — added Week 6
tools/                    offline MediaPipe landmark extraction (real test data)
frontend/src/fixtures/    REAL squat landmark data extracted from video (test/tuning)
journals/                 weekly dev journals (challenges, decisions, MVP cycle)
```

## Quick start (frontend)
```bash
cd frontend
npm install
# one-time: download the pose model into public/models/ (see below)
npm run dev            # http://localhost:5173
npm run test           # Vitest unit tests
npm run e2e            # Playwright E2E (run `npm run e2e:install` once first)
```

### Pose model asset
The MediaPipe model is not committed (it's a binary blob). Download it once:
```bash
curl -L -o frontend/public/models/pose_landmarker_lite.task \
  https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task
```

Backend setup instructions are added in the Week 6 entry once the API exists.

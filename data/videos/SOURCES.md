# Video sources

This directory is gitignored (raw video, not committed). Recorded here for
provenance of the fixtures generated from these clips.

## squat-demo.webm  →  frontend/src/fixtures/real-squat-good.json

- URL: https://commons.wikimedia.org/wiki/File:Squat_-_exercise_demonstration_video.webm
- Direct file: https://upload.wikimedia.org/wikipedia/commons/5/5c/Squat_-_exercise_demonstration_video.webm
- License: CC BY 3.0 (https://creativecommons.org/licenses/by/3.0)
- Author: FitnessScape (YouTube handle: fitnessscapefitness), via Wikimedia Commons
- Content: single person, barbell back squat in a home gym/garage rack, static
  camera, three-quarter/back view, 1280x720 @ 30fps, ~7.1s, 2 clean rep cycles.

## half-squat-cdc.webm  →  frontend/src/fixtures/real-squat-shallow.json

- URL: https://commons.wikimedia.org/wiki/File:Muscle_Strengthening_at_Home_-_Half_squat.webm
- Direct file: https://upload.wikimedia.org/wikipedia/commons/a/ae/Muscle_Strengthening_at_Home_-_Half_squat.webm
- License: Public domain (US CDC production)
- Content: single person, bodyweight half/partial squat, front-facing static
  camera, living room, 320x240 @ ~30fps native, ~78.6s total. The source clip
  also contains an unrelated wall-sit segment starting ~36s in (scene cut,
  different room) — that segment was DROPPED when building the fixture; only
  the first ~36s (freestanding half-squat reps) was kept.

## Not used (downloaded but rejected)

- squats-wikipedia.webm (https://commons.wikimedia.org/wiki/File:Squats_Wikipedia.webm,
  CC BY-SA 3.0) — handheld documentary-style footage with talking-head
  segments, extreme close-ups, and camera shake; MediaPipe pose detection
  rate was only ~49% and not usable as a clean fixture.
- basic-single-leg-squat.webm (https://commons.wikimedia.org/wiki/File:Basic_single_leg_squat.webm,
  CC BY-SA 4.0) — different exercise (single-leg squat), not the two-leg
  squat this project analyzes.

## Other sources tried and blocked

- Pexels (pexels.com) and Pixabay (pixabay.com): both returned HTTP 403 to
  curl for both the site and their video-search pages (bot/Cloudflare
  protection); their download APIs require a registered API key which was
  not available. Not used.

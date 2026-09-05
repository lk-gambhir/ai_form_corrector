# Dev Journal — Week 2: Smoothing, rolling buffer, coarse verification & real-data replay

## 1. Week & focus
Turn the raw per-frame landmark stream from Week 1 into a *stable, testable signal*
and prove the whole pipeline can run with **no camera** by replaying **real**
recorded pose data. Maps to **BUILD_GUIDE Phase 2**. This is the week the project
stops depending on a live webcam to make progress — everything downstream (reps,
rules, metrics, feedback) is now testable headlessly against real movement.

## 2. Goals for the week
- [x] `LandmarkSmoother` — per-landmark EMA to kill MediaPipe jitter.
- [x] `RollingBuffer` — fixed-capacity ring for temporal heuristics.
- [x] `ExerciseVerifier` — coarse "is this a squat, visible and moving?" gate (NOT rep counting).
- [x] `FrameSource` abstraction with two implementations: `ReplayFrameSource` (fixtures) and `CameraFrameSource` (live adapter) — the same pipeline for both.
- [x] Wire everything against **real** extracted fixtures and unit-test it.
- [x] Real squat pose data sourced (data-prep track): 2 permissively-licensed clips → MediaPipe → landmark JSON.

## 3. What I built
- `frontend/src/pose/LandmarkSmoother.js` — EMA (`s = α·cur + (1-α)·prev`) per x/y/z,
  with explicit **dropout/stale** handling: on a low-visibility landmark or a
  whole-frame dropout it *holds* the last good position but reports the **real
  current** confidence (0 on a full dropout), tagging the entry `stale:true`.
  Never emits NaN.
- `frontend/src/analysis/RollingBuffer.js` — fixed-capacity ring (`push/toArray/size/clear`).
- `frontend/src/analysis/ExerciseVerifier.js` — over a 30-frame window, computes
  `visibleRatio` (fraction of frames with ≥1 leg's hip+knee+ankle visible) and
  `angleRange` (max−min knee angle); `verified` when ratio ≥ 0.7 **and** range ≥ 20°.
- `frontend/src/pipeline/ReplayFrameSource.js` — replays a fixture's frames as
  `{landmarks, timestampMs}`, `null` at end; dropout frames pass through as `[]`.
- `frontend/src/pipeline/CameraFrameSource.js` — thin live adapter over
  `PoseEstimator` so Week 5 can swap camera↔replay behind one interface.
- Data-prep track (parallel subagent): `tools/extract_landmarks.py` +
  `data/videos/*` + `frontend/src/fixtures/{real-squat-good,real-squat-shallow}.json`
  + `frontend/src/fixtures/GROUND_TRUTH.md`.
- Tests: `LandmarkSmoother`, `RollingBuffer`, `ReplayFrameSource`, `ExerciseVerifier`.

## 4. MVP & development-cycle notes
Still pre-MVP (MVP lands Week 5), but this week removes the single biggest
process risk in the whole simulation: **you cannot iterate on rep-counting and
form-rules if the only way to get data is to physically squat in front of the
build machine.** By recording real movement once (`ReplayFrameSource`) and
feeding it through the *exact same* `FrameSource` interface the live camera will
use, every later week gets a fast, deterministic, real-data test loop. The MVP's
live path and the test path are now the same pipeline — no divergent "test-only"
code that could pass while the real app breaks.

## 5. Challenges & resolutions
1. **The plan's fixture timestamp unit was wrong — caught by verifying against
   the data, not the spec.** My own Week-2 spec said `frame.t` is seconds and
   `timestampMs = t·1000`. The builder checked the actual JSON: the good clip's
   last frame is `t=7066.67` across 213 frames @30fps, and `(213-1)/30·1000 ≈
   7067 ms` — so `t` is **already milliseconds**. Using `·1000` would have
   produced timestamps in the thousands-of-seconds range: silently wrong, and an
   *order-only* test (t strictly increasing) would still have passed. Fix:
   emit `timestampMs = frame.t` directly, document the verification in the file
   header, and add a real-fixture assertion pinning `frames[0].timestampMs === 0`.
   *Lesson logged:* trust the data over the doc, and write the assertion that
   would catch the plausible-but-wrong version.
2. **Confidence dropout must not silently look "fully visible" downstream.** A
   held/stale landmark still has a real x/y/z (for overlay continuity), so the
   naive move is to keep reporting its old visibility — which would let a
   completely dropped-out frame read as fully visible to the verifier. Resolved
   by always reporting the *current* frame's real confidence (0 on a whole-frame
   dropout) while holding position, and tagging `stale:true`. The verifier and
   any angle consumer thus still gate correctly on true confidence. Covered by an
   explicit smoother test and by running the real shallow fixture (which has 2
   genuine dropout frames) through end-to-end asserting no NaN ever appears.
3. **Verifier thresholds had to be *measured* on real data, not guessed.** A
   tight window (10 frames) or a high range threshold (60°) would fail the
   real **half-squat** fixture (whose knee-angle range peaks at only ~80–88°,
   and is front-facing which flattens the sagittal angle) or flicker on brief
   occlusion. The builder ran a throwaway sliding-window sweep (30/45/60 frames)
   over *both* real fixtures before settling on 30 / 0.7 / 20° — which cleanly
   separates both real squats (verified) from synthetic static-standing
   (range ≈ 0) and all-dropout (ratio = 0). Real observed numbers are recorded in
   the verifier header and test.
4. **Data-prep: `pip install mediapipe` now breaks the legacy Pose API.** The
   offline extractor needs MediaPipe's landmark output; current `mediapipe`
   (1.0.1) *removed* the legacy `mp.solutions.pose` solution entirely (Tasks API
   only). Fix: pin `mediapipe==0.10.14` in the `.venv-extract` venv. Also,
   Pexels/Pixabay both 403'd headless downloads (Cloudflare, API-key required),
   so the real clips came from **Wikimedia Commons** under CC-BY / public-domain
   licenses (full provenance in `data/videos/SOURCES.md`).

## 6. Key decisions & trade-offs
- **`stale` flag as a superset of the Landmark shape** — downstream code that
  only reads x/y/z/visibility is unaffected; code that cares about held-position
  can opt in. Keeps the contract additive.
- **Coarse verifier, not a classifier** — Week 2 only needs "plausibly a moving,
  visible squat"; precise rep boundaries are Week 3's state machine. Kept the
  heuristic geometric and cheap (no ML), consistent with the whole design.
- **Real data over synthetic** (per direction) — accepted the honest limitations
  it brings: the good clip is short (2 reps, three-quarter/back view) and the
  shallow clip is front-facing with a ~6s arm-raise warmup. These are documented
  in `GROUND_TRUTH.md` and shape later assertions rather than being hidden.

## 7. Testing evidence
- **Vitest: 41/41 passing** (Week 1's 13 + **28 new**: 10 smoother, 6 rolling-buffer,
  6 replay-source, 6 verifier). Real-fixture assertions include: the good clip
  drives `verified:true` (~frame 43, ~1.4s in); the shallow clip stays unverified
  through its non-squat warmup then verifies; static-standing and all-dropout
  stay `verified:false` with sensible reasons; the real shallow-clip dropout
  frames never yield NaN.
- **Build:** `npm run build` clean (~326 KB JS / ~101 KB gzip, ~640 ms).
- **Playwright:** no new UI this week (pipeline is pure logic, exercised
  thoroughly by Vitest on real data); the Week 1 smoke E2E remains green. New E2E
  arrives with the live analysis UI in Week 5.
- **Independent review caught a real HIGH bug before commit.** A separate
  code-review pass over the Week 2 pipeline found that `LandmarkSmoother`'s
  whole-frame-dropout branch did `_state.map(...).filter(Boolean)` — so any
  landmark never yet seen at good confidence (a `null` state slot) was *dropped*,
  **shifting every later landmark's index** and feeding the wrong joint to
  downstream angle math. The builder's own dropout test masked it (it seeded all
  33 landmarks good first, so no nulls existed). *Fix:* emit a zero/zero-confidence
  placeholder for never-seen slots so the output is always length 33, never
  shifted (contract: smoother returns `[]` or exactly `LANDMARK_COUNT`). Added
  two regression tests — dropout-with-a-null-state-slot (pins length 33, no
  shift) and first-frame low-visibility passthrough — the +2 that took the suite
  from 39 to 41. Also hardened `ReplayFrameSource.next()` to shallow-copy the
  landmark array so an in-place mutation downstream can't corrupt the shared
  imported fixture across replays/tests. Two lower findings (a live
  `CameraFrameSource` is intentionally non-null-terminating vs. the replay
  source; fixed-α EMA is frame-rate dependent — see §8) were accepted as
  documented design limits, not bugs.

## 8. Open questions / risks
- Good fixture is only **2 reps** — thin for rep-count statistics. Week 3 will
  supplement with the shallow clip (3 half-squat reps) and, where needed for
  pathological cases (valgus/lean), small hand-derived edge fixtures, since no
  permissively-licensed *bad-form* clip was findable.
- **Fixed-α EMA is frame-rate dependent** (review finding #5): a constant α has a
  different effective time-constant at 30 fps (good clip), ~15 fps (shallow clip)
  and variable live-camera rates — so smoothing *lag* differs by source even
  though the pipeline is structurally identical. Not a bug now, but Week 3's
  tempo/velocity logic will inherit this; may switch to a time-constant-based α
  (α = f(Δt)) if tempo metrics prove rate-sensitive.
- Short-but-nonempty frames (length 1–32) are treated as full dropouts by both
  smoother and verifier — correct for real all-or-nothing MediaPipe output;
  noted in case a future source emits partial frames.

## 9. Next week
Week 3: the **squat rep state machine** driven entirely by `squat.config.js`
(states / thresholds / hysteresis / min-frames), a rep counter, and transition
logging — proving `real-squat-good.json` counts **2** and the shallow clip counts
**3** (with the cut-off 4th correctly *not* counted) headlessly, against the
human-counted `GROUND_TRUTH.md`.

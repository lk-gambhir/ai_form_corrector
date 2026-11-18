// Regression tests for the code-review fixes: rep detection and rules on the
// bundled fixtures, view-aware squat scoring, angle helpers and UI helpers.
import { AnalysisPipeline, CUE_HOLD_MS } from "@/pipeline/AnalysisPipeline.js";
import { calculateFormScore, squatDepthTargetDeg } from "@/analysis/FormRuleEngine.js";
import { FeedbackSelector } from "@/analysis/FeedbackSelector.js";
import { MetricsEngine } from "@/analysis/MetricsEngine.js";
import { jointAngle2D, kneeAnkleRatio, toSquareUnits, bodyYawDeg } from "@/pose/angles.js";
import { createTemporaryPerformanceMonitor } from "@/debug/temporaryPerformanceInstrumentation.js";
import { apiRequest, AUTH_EXPIRED_EVENT } from "@/api/client.js";
import { getExerciseConfig } from "@shared/exercise-config/index.js";
import squatGood from "@/fixtures/real-squat-good.json";
import squatShallow from "@/fixtures/real-squat-shallow.json";
import deadliftGood from "@/fixtures/synthetic-deadlift-good.json";
import deadliftSoft from "@/fixtures/synthetic-deadlift-soft-lockout.json";
import pushupGood from "@/fixtures/synthetic-pushup-good.json";
import pushupShallow from "@/fixtures/synthetic-pushup-shallow.json";

function replay(exerciseId, fixture) {
  const pipeline = new AnalysisPipeline(getExerciseConfig(exerciseId));
  pipeline.setFrameSize(fixture.width, fixture.height);
  const frames = [];
  for (const frame of fixture.frames) frames.push(pipeline.processFrame(frame.landmarks, frame.t));
  const reps = pipeline.machine.getReps();
  const results = reps.map((rep) => Object.fromEntries(pipeline.ruleEngine.evaluate(rep).map((r) => [r.ruleId, r])));
  return { pipeline, reps, results, frames };
}

// Synthetic squat filmed from the front (z = 0 for every landmark, so the body
// is square to the camera). Hips drop from 0.5 to 0.7 (thighs parallel).
function frontViewSquat({ caving }) {
  const lm = (x, y) => ({ x, y, z: 0, visibility: 0.99 });
  const frames = [];
  for (let i = 0; i < 300; i++) {
    const depth = Math.max(0, Math.sin((i / 150) * 2 * Math.PI - Math.PI / 2) * 0.5 + 0.5);
    const hipY = 0.5 + 0.2 * depth;
    const kneeHalf = caving ? 0.07 - 0.04 * depth : 0.07;
    const L = Array.from({ length: 33 }, () => lm(0.5, 0.5));
    L[11] = lm(0.42, hipY - 0.25); L[12] = lm(0.58, hipY - 0.25);
    L[23] = lm(0.45, hipY); L[24] = lm(0.55, hipY);
    L[25] = lm(0.5 - kneeHalf, 0.72); L[26] = lm(0.5 + kneeHalf, 0.72);
    L[27] = lm(0.44, 0.9); L[28] = lm(0.56, 0.9);
    frames.push({ t: i * 33.3, landmarks: L });
  }
  return { width: 1000, height: 1000, frames };
}

describe("fixtures", () => {
  test("real squat (good): 2 reps, depth and torso lean pass, valgus not measured from this angle", () => {
    const { reps, results } = replay("squat", squatGood);
    expect(reps).toHaveLength(2);
    for (const r of results) {
      expect(r.depth.pass).toBe(true);
      expect(r.torso_lean.notMeasured).toBe(false);
      expect(r.torso_lean.pass).toBe(true);
      expect(r.knee_valgus.notMeasured).toBe(true);
      expect(r.tempo.pass).toBe(true);
    }
  });

  test("real squat (shallow clip): 3 reps and at least one depth failure", () => {
    const { reps, results } = replay("squat", squatShallow);
    expect(reps).toHaveLength(3);
    expect(results.some((r) => !r.depth.pass)).toBe(true);
  });

  test("deadlift: true setup angle is recorded and only the soft lockout fails", () => {
    const good = replay("deadlift", deadliftGood);
    const soft = replay("deadlift", deadliftSoft);
    expect(good.reps).toHaveLength(2);
    expect(soft.reps).toHaveLength(2);
    for (const rep of good.reps) expect(rep.angleMetrics.hipSetupDeg).toBeLessThan(90);
    expect(good.results.every((r) => r.lockout.pass && r.movement_range.pass)).toBe(true);
    expect(soft.results.every((r) => !r.lockout.pass && r.movement_range.pass)).toBe(true);
  });

  test("push-up: shallow reps fail range of motion", () => {
    expect(replay("push_up", pushupGood).results.every((r) => r.range_of_motion.pass)).toBe(true);
    const shallow = replay("push_up", pushupShallow);
    expect(shallow.reps).toHaveLength(2);
    expect(shallow.results.every((r) => !r.range_of_motion.pass)).toBe(true);
  });

  test("a failing rep's cue stays on screen after the rep, not for one frame", () => {
    const { frames } = replay("push_up", pushupShallow);
    const firstCue = frames.findIndex((f) => f.feedback.activeCue);
    const frameMs = pushupShallow.frames[1].t - pushupShallow.frames[0].t;
    // The fixture ends ~1.3 s after the first rep, before CUE_HOLD_MS runs out,
    // so the cue must still be showing on the last frame.
    expect(firstCue).toBeGreaterThan(-1);
    expect((frames.length - firstCue) * frameMs).toBeLessThan(CUE_HOLD_MS);
    expect(frames.slice(firstCue).every((f) => f.feedback.activeCue)).toBe(true);
  });
});

describe("front-view squat and knee valgus", () => {
  test("reps are counted from the front and knees over ankles pass", () => {
    const { reps, results } = replay("squat", frontViewSquat({ caving: false }));
    expect(reps).toHaveLength(2);
    for (const r of results) {
      expect(r.knee_valgus.notMeasured).toBe(false);
      expect(r.knee_valgus.pass).toBe(true);
      expect(r.torso_lean.notMeasured).toBe(true);
    }
  });

  test("knees caving inward fail knee valgus", () => {
    const { results } = replay("squat", frontViewSquat({ caving: true }));
    expect(results.every((r) => !r.knee_valgus.pass && r.knee_valgus.measured < 0.9)).toBe(true);
  });

  test("knee-to-ankle ratio needs a front view", () => {
    const L = frontViewSquat({ caving: false }).frames[0].landmarks;
    expect(bodyYawDeg(L)).toBe(0);
    expect(kneeAnkleRatio(L)).toBeCloseTo(0.14 / 0.12, 3);
    const turned = L.map((p, i) => ([11, 23].includes(i) ? { ...p, z: 0.3 } : p));
    expect(Number.isNaN(kneeAnkleRatio(turned))).toBe(true);
  });
});

describe("scoring", () => {
  const cfg = getExerciseConfig("squat");
  const rep = (n, metrics = {}) => ({ repNumber: n, angleMetrics: metrics });

  test("rules not measured on any rep are dropped and weights rescaled", () => {
    const reps = [rep(1, { torsoLeanMaxDeg: 10 }), rep(2, { torsoLeanMaxDeg: 12 })];
    // depth fails on rep 1; valgus unmeasured -> weights depth .35, lean .25, tempo .15 over .75
    const score = calculateFormScore(reps, [{ repNumber: 1, issueType: "depth" }], cfg.scoreWeights, cfg.scoreMeasuredBy);
    expect(score).toBeCloseTo(((0.35 * 0.5 + 0.25 + 0.15) / 0.75) * 100, 2);
  });

  test("valgus counts only reps where it was measured", () => {
    const reps = [rep(1, { kneeAnkleRatio: 0.7 }), rep(2, {}), rep(3, { kneeAnkleRatio: 1.1 })];
    const issues = [{ repNumber: 1, issueType: "knee_valgus" }];
    // valgus pass rate 1/2 over measured reps 1 and 3; lean unmeasured everywhere
    const expected = ((0.35 + 0.25 * 0.5 + 0.15) / 0.75) * 100;
    expect(calculateFormScore(reps, issues, cfg.scoreWeights, cfg.scoreMeasuredBy)).toBeCloseTo(expected, 2);
  });

  test("metrics engine passes the view metrics through to the saved rep", () => {
    const m = new MetricsEngine().compute({ repNumber: 1, startMs: 0, bottomMs: 500, endMs: 1500, minAngleDeg: 80, peakAngleDeg: 170, angleMetrics: { kneeAnkleRatio: 1.02 } });
    expect(m.angleMetrics.kneeAnkleRatio).toBe(1.02);
  });
});

describe("helpers", () => {
  test("aspect-ratio correction recovers true angles on a 16:9 frame", () => {
    // A true right angle in pixels on a 1280x720 frame.
    const a = { x: 740 / 1280, y: 260 / 720 }, v = { x: 640 / 1280, y: 260 / 720 }, c = { x: 640 / 1280, y: 360 / 720 };
    expect(jointAngle2D(a, v, c)).toBeCloseTo(90, 5); // perpendicular axes survive either way
    const a2 = { x: 740 / 1280, y: 360 / 720 }; // 45 deg in pixels
    const raw = jointAngle2D(a2, v, c);
    const [A, V, C] = toSquareUnits([a2, v, c], 1280 / 720);
    expect(Math.abs(raw - 45)).toBeGreaterThan(5);
    expect(jointAngle2D(A, V, C)).toBeCloseTo(45, 5);
  });

  test("baseline label and depth rule use the same target", () => {
    const rule = getExerciseConfig("squat").rules.depth;
    expect(squatDepthTargetDeg(rule, null)).toBe(90);
    expect(squatDepthTargetDeg(rule, { kneeBottom: 110 })).toBe(115);
    expect(squatDepthTargetDeg(rule, { kneeBottom: 50 })).toBe(70);
  });

  test("feedback selector never repeats the previous rep's cue", () => {
    const sel = new FeedbackSelector();
    expect(sel.select([{ pass: false, cue: "Go deeper", severity: "high", priority: 1 }]).activeCue).toBe("Go deeper");
    expect(sel.select([{ pass: true, cue: "" }]).activeCue).toBeNull();
  });

  test("performance monitor reports when it stops measuring", () => {
    const m = createTemporaryPerformanceMonitor({ durationMs: 1000 });
    expect(m.isMeasuring()).toBe(false);
    m.startSession();
    expect(m.isMeasuring()).toBe(true);
  });

  test("a 401 for our token fires the auth-expired event", async () => {
    localStorage.setItem("token", "expired");
    const listener = vi.fn();
    window.addEventListener(AUTH_EXPIRED_EVENT, listener);
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ detail: "Could not validate credentials" }), { status: 401 }));
    await expect(apiRequest("/sessions")).rejects.toMatchObject({ status: 401 });
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
    localStorage.removeItem("token");
  });
});

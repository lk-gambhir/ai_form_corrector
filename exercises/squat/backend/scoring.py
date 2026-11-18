EXERCISE_ID = "squat"
SCORE_WEIGHTS = {
    "depth": 0.35,
    "knee_valgus": 0.25,
    "torso_lean": 0.25,
    "tempo": 0.15,
}
ISSUE_IDS = frozenset(SCORE_WEIGHTS)

# Rules that are only scored on reps where they could be measured: the rep's
# angle_metrics must contain this key (or the rep logged an issue for the
# rule). knee_valgus needs a front-view frame (knee-to-ankle ratio, Mizner et
# al. 2012), so side-view reps leave it out of the score instead of passing
# it for free. Mirrors scoreMeasuredBy in exercises/squat/config/exercise.config.js.
# torso_lean is the reverse case: forward lean cannot be seen from the front.
SCORE_MEASURED_BY = {"knee_valgus": "kneeAnkleRatio", "torso_lean": "torsoLeanMaxDeg"}

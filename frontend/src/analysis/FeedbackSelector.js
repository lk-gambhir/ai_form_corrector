// Picks the coaching cue to show for a completed rep.
//
// It is called once per completed rep, and AnalysisPipeline keeps the cue on
// screen for CUE_HOLD_MS. A wall-clock debounce here used to return the
// previous rep's cue when a passing rep finished within 1.5 s of a failing
// one, so each rep's cue now depends only on that rep's results.
export class FeedbackSelector {
  // Returns the highest-priority failed rule's cue, or no cue if all passed.
  select(ruleResults) {
    const severityMap = { high: 3, medium: 2, low: 1 };
    const failedRules = ruleResults.filter((r) => !r.pass);
    failedRules.sort((a, b) =>
      (a.priority ?? Number.MAX_SAFE_INTEGER) - (b.priority ?? Number.MAX_SAFE_INTEGER)
      || (severityMap[b.severity] ?? 0) - (severityMap[a.severity] ?? 0)
    );
    const top = failedRules[0];
    return top ? { activeCue: top.cue, severity: top.severity } : { activeCue: null, severity: null };
  }

  reset() {}
}

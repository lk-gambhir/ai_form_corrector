---
name: week-4-implementation
description: Implemented rep form validation and metric computation.
metadata:
  type: project
---

Implemented `FormRuleEngine` for form validation and `MetricsEngine` for analytical metrics (ROM, tempo). Leveraged the `rep` object provided by the state machine and defined threshold rules in `squat.config.js`.

**Why:** The squat analyzer needs to provide actionable feedback on form adequacy, not just rep count.
**How to apply:** Use `FormRuleEngine` for per-rep rule evaluation and `MetricsEngine` to compute trends (ROM, tempo) for the user dashboard.

---
name: review-against-spec
description: Review LaughterMaster changes against SPEC.md acceptance criteria and non-functional requirements. Report gaps, untested criteria, and scope creep. Use before committing a milestone, when asked "is this done?", or when reviewing a PR.
---

# Review against spec

1. Identify the stories the change claims to deliver (from PLAN.md or the commit/PR).
2. For each acceptance criterion, find the test that proves it. Classify each as:
   - **Covered:** a test asserts the exact behavior.
   - **Partially covered:** a test exists but misses a branch (an error path, a limit, a logged-out user).
   - **Not covered:** there's no test, or it's only verified by hand.
3. Check the non-functional requirements the change touches: safety and moderation, privacy (no emails exposed), secrets, rate limits, accessibility.
4. Flag **scope creep**: behavior that isn't in the spec.
5. Report as a table (criterion → status → evidence), then a short verdict: **ready / ready with nits / not ready**.

Correctness bugs in the code itself are a job for `/code-review`. This skill checks spec conformance.

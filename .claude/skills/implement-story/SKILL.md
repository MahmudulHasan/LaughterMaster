---
name: implement-story
description: Implement one LaughterMaster user story or PLAN.md task end to end. Covers reading its acceptance criteria, a short plan, tests first, code, checks, and ticking PLAN.md. Use when asked to build a story (US-n), a milestone task, or "the next task".
---

# Implement a story

1. **Locate it.** Find the story in `SPEC.md` and its task in `PLAN.md`. If the request isn't in the spec, stop and ask (or use the product-owner skill to add it first).
2. **Plan briefly.** List the files to touch and the tests to write, in 3–8 bullets. For anything non-trivial, show this to the user before coding.
3. **Tests first.** Turn each Given/When/Then criterion into a failing test (Vitest for logic and API, Testing Library for components, Playwright only for the end-to-end flows the plan names).
4. **Implement** the smallest change that makes the tests pass. Follow the conventions in `CLAUDE.md`.
5. **Verify.** Run `npm run check`. For UI changes, also run the app and look at it.
6. **Close out.** Tick the task in `PLAN.md`, and summarize what changed, which criteria are covered, and anything not verified. Commit only when the user asks.

## Guardrails
- Never call the real Claude API in tests; mock the SDK.
- Never put secrets in code or commits.
- If an acceptance criterion turns out to be wrong or impossible, stop and raise it. Don't quietly change behavior.

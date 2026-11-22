---
name: plan-milestones
description: Turn SPEC.md user stories into PLAN.md, a sequence of small, shippable milestones with tasks and exit criteria. Use when creating or re-sequencing the plan, after the spec changes, or when deciding what to build next.
---

# Plan milestones

## Rules
- Each milestone delivers a **vertical slice** a user could try (UI + API + data + tests), except foundation milestones.
- Each milestone lists the story IDs it delivers (`US-<n>`) and has an **exit criterion**: the acceptance criteria that must pass.
- Order by dependency first, then by risk: do the riskiest unknowns (auth, AI calls) early enough to learn from them.
- Keep milestones small: roughly 1–3 focused sessions each. Split anything larger.
- Each task is a checkbox, phrased as an outcome ("Vote API rejects self-votes"), not an activity ("work on votes").
- Every milestone ends with: tests green (`npm run check`), a review, a commit, and a PLAN.md update.
- Note which course practice each milestone exercises, since this is a learning project.

## After the spec changes
Re-read SPEC.md's changelog and update only the affected milestones. Never silently drop a Must story; move it and say so.

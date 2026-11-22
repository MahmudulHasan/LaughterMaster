# CLAUDE.md

Guidance for Claude Code working in this repo.

## Project
LaughterMaster is a joke web app (Next.js + TypeScript). The spec is in `SPEC.md` and the milestones are in `PLAN.md`.
It is also a learning project for the AI-native SDLC course, so keep changes small and explain trade-offs.

## Workflow rules
- Read `SPEC.md` and the current milestone in `PLAN.md` before starting work.
- Work one milestone task at a time. Propose a short plan before writing code for anything non-trivial.
- Write or update tests alongside the code. A task isn't done until `npm run check` passes.
- If a change conflicts with the spec, stop and ask. Don't silently diverge.
- Tick off items in `PLAN.md` when they're done.
- Never commit secrets. `ANTHROPIC_API_KEY` lives in `.env.local` only.
- No real Claude API calls in tests; mock the SDK.

## Commands (fill in once scaffolded in M1)
- `npm run dev`: start the dev server
- `npm run check`: lint + typecheck + test

## Conventions
- TypeScript strict mode; no `any` without a comment explaining why.
- API routes validate input with zod.
- Components in `src/components`, server logic in `src/server`.

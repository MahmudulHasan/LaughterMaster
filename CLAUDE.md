# CLAUDE.md

Guidance for Claude Code working in this repo.

## Project
LaughterMaster is a public community joke platform: members post jokes, like or dislike them, and the home page shows the top 10 from the last 24 hours. Claude moderates, categorizes, catches duplicates, and posts a daily AI joke.
- `intent.md`: the author's goals and decisions (highest authority)
- `SPEC.md`: user stories (US-n) with acceptance criteria
- `PLAN.md`: milestones and current status

It is also a learning project for the AI-native SDLC course, so keep changes small and explain trade-offs.

## Project skills (`.claude/skills/`)
- `product-owner`: write or change the spec, settle product questions
- `plan-milestones`: turn the spec into PLAN.md
- `implement-story`: build one story or task, test-first
- `review-against-spec`: check a change against acceptance criteria before committing

## Workflow rules
- Read `SPEC.md` and the current milestone in `PLAN.md` before starting work.
- Work one milestone task at a time. Propose a short plan before writing code for anything non-trivial.
- Write or update tests alongside the code. A task isn't done until `npm run check` passes.
- If a change conflicts with the spec, stop and ask. Don't silently diverge.
- Tick off items in `PLAN.md` when they're done.
- Never commit secrets. `ANTHROPIC_API_KEY` and the OAuth secrets live in `.env.local` only.
- No real Claude or OAuth calls in tests; mock them.
- Never make a joke public without moderation (SPEC US-11: fail closed).
- Never expose a user's email in a page or API response.

## Commands (fill in once scaffolded in M1)
- `npm run dev`: start the dev server
- `npm run check`: lint + typecheck + test

## Conventions
- TypeScript strict mode; no `any` without a comment explaining why.
- API routes validate input with zod.
- Data access via Drizzle; PGlite locally and in tests.
- Components in `src/components`, server logic in `src/server`.

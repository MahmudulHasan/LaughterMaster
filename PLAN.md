# LaughterMaster: Build Plan

Small, reviewable milestones. Each one ends with passing tests, a commit, and a quick review.
Tick boxes as you go, and map each milestone to the course module where you practice that skill.

## M0: Foundations
- [x] Empty repo + `git init`
- [x] `SPEC.md`, `PLAN.md`, `CLAUDE.md`
- [ ] Resolve the open questions in SPEC.md §8
- [ ] First commit

## M1: Scaffold & tooling
- [ ] Next.js + TypeScript + Tailwind scaffold
- [ ] ESLint, Prettier, Vitest configured; `npm run check` runs lint + typecheck + test
- [ ] GitHub Actions CI running `npm run check`
- **Done when:** CI is green on an empty app.

## M2: Joke library (F1, F2)
- [ ] Data model + seed of ~50 jokes across 5 categories
- [ ] `GET /api/jokes/random?category=` with tests
- [ ] Home page: joke card, Next button, category filter
- **Done when:** acceptance criteria F1 and F2 pass in tests.

## M3: AI generator (F3)
- [ ] `POST /api/generate` calling Claude: input validation, family-friendly system prompt, rate limit
- [ ] Tests with the SDK mocked (no real API calls in CI)
- [ ] UI: topic input, style picker, loading and error states
- **Done when:** F3 criteria pass; the key is only server-side.

## M4: Ratings & favorites (F4, F5, F6)
- [ ] Vote API with one vote per client per joke
- [ ] Favorites in localStorage + Favorites page
- [ ] Copy to clipboard
- **Done when:** F4–F6 criteria pass.

## M5: Quality & ship
- [ ] Playwright smoke test (load, next joke, favorite, reload)
- [ ] Accessibility pass + security review (`/security-review`)
- [ ] Deploy (if chosen) + README

# LaughterMaster 😂

[![CI](https://github.com/MahmudulHasan/LaughterMaster/actions/workflows/ci.yml/badge.svg)](https://github.com/MahmudulHasan/LaughterMaster/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/live-laughter--master.vercel.app-black?logo=vercel)](https://laughter-master.vercel.app)

A community joke platform. Anyone can read jokes. Members sign in with Google to post, like and dislike them, and the home page shows the **top 10 jokes of the last 24 hours**. Claude works behind the scenes as a **moderator, categorizer and duplicate-catcher**.

**Live:** https://laughter-master.vercel.app

> I built this to take one real project through every stage of an **AI-native software development life cycle**: intent → spec → plan → build → test → review → ship. Every requirement is written down, every story has acceptance criteria, and every acceptance criterion has an automated test.

---

## Features

| Area | What it does |
|------|--------------|
| **Top 10 of the day** | Ranks jokes from the last rolling 24 hours by likes − dislikes, with tie-breaks. If fewer than 10 exist, it fills from the past week under "From this week". |
| **Posting** | 10–500 characters in **any language** (counted as Unicode graphemes), up to 10 posts per member per day. |
| **Voting** | Like or dislike, then switch or undo. No voting on your own jokes (blocked in the UI and with a 403 from the API). Vote counts are private. |
| **AI moderation** | Every joke is screened by Claude on submit. It blocks clear violations, assigns a category (pun, dad joke, tech…) and catches exact and near-duplicates. If Claude is unavailable, the joke **stays pending** rather than going public (fails closed). |
| **Reports & admin** | Members can report jokes. 5 reports hide a joke until an admin restores or removes it. Admins can also ban members. |
| **Profiles & lists** | Public profiles and an All jokes page, lazy-loaded with **cursor pagination**, so new jokes never cause duplicates or gaps while you scroll. |
| **Sharing** | Each joke has its own page and a generated 1200×630 preview card for Facebook, WhatsApp and X. Bangla text is shaped with HarfBuzz so it renders correctly. |
| **Privacy** | Email addresses never appear on any page or in any API response. Tests check this. |

## Tech stack

- **App:** Next.js 16 (App Router) · TypeScript (strict) · Tailwind CSS
- **Auth:** Auth.js v5 with Google as the only provider
- **Data:** Drizzle ORM on Postgres. Production uses Neon, while local development and tests use in-process PGlite.
- **AI:** Anthropic SDK with Claude, returning structured output validated with Zod
- **Testing:** Vitest · Testing Library · jsdom
- **Quality gates:** ESLint · Prettier · `tsc --noEmit` · GitHub Actions
- **Hosting:** Vercel + Neon

## Quality & testing

- **325 automated tests in 41 files**, covering API routes, ranking, moderation, pagination, permissions and UI components.
- **One gate for "done":** `npm run check` runs lint, a format check, the type check and all tests. CI runs it plus a production build on every push and pull request.
- **Real database in tests:** tests run against an in-memory Postgres (PGlite) with the real migrations, not mocks.
- **Deterministic AI tests:** tests always use a fake moderator and never call the real Claude API or Google OAuth.
- **Fixed clocks:** ranking is unit-tested with fixed timestamps, so the 24-hour and 7-day windows give the same results on every run.
- **Spec traceability:** user stories (`US-n`) and decisions (`D-n`) in [`SPEC.md`](SPEC.md) map to milestones in [`PLAN.md`](PLAN.md) and to tests.

## How it was built

| Stage | Artifact |
|-------|----------|
| Intent | [`intent.md`](intent.md): the author's goals and decisions, captured in a Q&A brainstorm |
| Spec | [`SPEC.md`](SPEC.md): user stories with Given/When/Then acceptance criteria, non-functional requirements and a decision log |
| Plan | [`PLAN.md`](PLAN.md): milestones M0–M9 with checklists and status |
| Build & test | One story at a time, test-first, using the project skills in [`.claude/skills/`](.claude/skills) |
| Review | Each change is checked against the spec's acceptance criteria before it's committed |
| Ship | CI on every push, deployed to Vercel with hosted Postgres |
| Docs | [`docs/API.md`](docs/API.md): HTTP API reference |

**Status:** milestones M0–M7 are done. M9 (ship) is in progress: Playwright end-to-end smoke tests, an accessibility pass with axe, and a security review are still to come. Google sign-in is limited to approved test users until the OAuth consent screen is published, but anyone can browse and read jokes.

## Run it locally

Requires **Node.js 22+**.

```bash
git clone https://github.com/MahmudulHasan/LaughterMaster.git
cd LaughterMaster
npm install
cp .env.example .env.local   # then set AUTH_SECRET (npx auth secret)
npm run db:seed              # 3 dev users + 36 sample jokes
npm run dev                  # http://localhost:3000
```

No external services are needed to try it locally:

- **Database:** uses a local PGlite folder when `DATABASE_URL` is empty.
- **Sign-in:** when Google isn't configured, development offers **"Sign in as"** seeded test users. This option never exists in a production build.
- **Moderation:** skipped in development when `ANTHROPIC_API_KEY` is empty. Production fails closed instead.

See [`.env.example`](.env.example) for every variable.

### Useful commands

| Command | What it does |
|---------|--------------|
| `npm run check` | Lint + format check + typecheck + all tests (the CI gate) |
| `npm test` | Run all tests once |
| `npx vitest run path/to/file.test.ts` | Run one test file |
| `npm run db:generate` | Create a migration after changing `src/server/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run moderate:pending` | Retry moderation for jokes still pending |

> Only one process can open the local database at a time. Stop `npm run dev` before running `db:seed` or `next build`.

## Project structure

```
src/
├── app/              # Pages and API routes (App Router)
│   ├── api/          # /api/jokes, votes, auth
│   ├── joke/[id]/    # Joke page + generated share image
│   ├── u/[id]/       # Member profiles
│   └── admin/        # Moderation queue (admins only)
├── components/       # UI components, with tests next to them
└── server/           # Business logic: jokes, ranking, moderation, auth, admin
drizzle/              # SQL migrations
scripts/              # Seed, migrate and moderation retry scripts
docs/API.md           # API reference
```

## Author

**Mahmudul Hasan**, Senior SDET
[Portfolio](https://mahmudulhasan.github.io) · [LinkedIn](https://www.linkedin.com/in/mahmudulhasanautul/) · [GitHub](https://github.com/MahmudulHasan)

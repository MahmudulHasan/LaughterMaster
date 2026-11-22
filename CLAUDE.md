# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

LaughterMaster is a public community joke platform: anyone can read jokes, signed-in members post, like and dislike them, and the home page shows the top 10 from the last 24 hours. Claude moderates, categorizes, catches duplicates and posts a daily AI joke.

Milestones M1 (scaffold, CI) and M2 (sign-in) are done; M3 is in progress, with posting (`/post`), the joke page (`/joke/[id]`) and deleting your own joke built. Check `PLAN.md` for the current milestone. It is also a learning project for the AI-native SDLC course, so keep changes small and explain trade-offs.

## Sources of truth

Precedence: `intent.md` (author's decisions) > `SPEC.md` (user stories `US-n`, acceptance criteria, decision log `D-n`) > `PLAN.md` (milestones M0–M9, current status).

- Read the relevant stories and the current milestone before working. If a request conflicts with the spec, stop and ask.
- Spec changes: bump the version in its header, add a changelog line, and note the affected milestones in `PLAN.md`. Decisions marked **PO decision (confirm)** are defaults the author hasn't approved yet.
- Tick `PLAN.md` boxes as tasks finish.
- UI mockups live on a design canvas outside the repo: https://claude.ai/artifact/SAN8r2vhi7UNGDXBgCDzxF

Project skills in `.claude/skills/`: `product-owner` (spec changes), `plan-milestones` (re-plan), `implement-story` (build one story test-first), `review-against-spec` (check criteria coverage before committing).

## Commands

Node 22+. Copy `.env.example` to `.env.local` for local secrets.

- `npm run dev`: dev server
- `npm run check`: lint + Prettier check + `tsc --noEmit` + all tests. This is the gate for "done", and CI runs it followed by `npm run build`.
- `npm run test` runs all tests. A single file: `npx vitest run src/server/db/db.test.ts`. A single test by name: add `-t "name"`.
- `npm run format`: Prettier write. Markdown and `.claude/` are deliberately not formatted.
- `npm run db:generate`: create a migration in `drizzle/` after changing `src/server/db/schema.ts`.

## How the scaffold fits together

- **Tests** (`vitest.config.mts`): two projects chosen by file extension. `*.test.tsx` runs in jsdom with Testing Library (`vitest.setup.ts`); `*.test.ts` runs in node, which PGlite needs. Name a test file to match the environment it needs.
- **Database** (`src/server/db/`): `createDb({ inMemory })` builds a Drizzle client on PGlite; app code uses the lazy shared `getDb()`, and callers depend on the `Db` type so the M9 switch to hosted Postgres only changes this factory. Local data lives in `PGLITE_DATA_DIR` (default `./.data/pglite`, gitignored). `runMigrations(db)` applies `drizzle/` from the repo root. Tests use an in-memory DB plus `runMigrations`.
- **Auth** (`src/auth.ts`, `src/server/auth/`): Auth.js v5 beta with JWT sessions. Google is registered only when `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` are set; until M9 local development uses the dev-only "Sign in as" test users (`dev-mina`, `dev-priya`, `dev-admin`), which exist only when `NODE_ENV=development` and Google isn't configured. `next dev` needs `AUTH_SECRET` in `.env.local`. Sign-in failures redirect back to the starting page with `?signin=failed`; `/auth/error` is a redirect route, not a page. Only `src/server/auth/safe-redirect.ts` is safe to import from client code.
- `next.config.ts` enables `cacheComponents` (Next 16). Consequences learned the hard way:
  - A Server Component that calls `auth()` must `await connection()` first and sit inside `<Suspense>` (the header does); otherwise prerendering fails and the page never hydrates. Component tests stub `connection` in `vitest.setup.ts`.
  - A page always streams with status 200, so `notFound()` gives the not-found UI plus `noindex`, never an HTTP 404 (SPEC D16). Read data inside `<Suspense>` after `connection()`; `new Date()` in a server component also needs `connection()` first.
  - `@electric-sql/pglite` is in `serverExternalPackages`; bundling it breaks its file loading.
- Client effects must survive React StrictMode's double run in dev (e.g. a `<dialog>` cleanup must not call `close()`).
- Only one `next dev` can run per project folder.

## Planned architecture (from SPEC.md §4–7)

Stack: Next.js App Router + TypeScript (strict) + Tailwind, Auth.js with **Google as the only provider**, Drizzle ORM on Postgres (**PGlite locally and in tests**, hosted Postgres when deployed), Anthropic SDK, `next/og` for share images, Vitest + Testing Library + Playwright. Validate API input with zod. Components go in `src/components`, server logic in `src/server`.

Cross-cutting rules that span many files:
- **Joke status lifecycle** drives visibility everywhere: `pending | approved | rejected | hidden | removed | deleted`. Only `approved` jokes are public. The author alone also sees their own `pending` jokes on their profile.
- **Moderation fails closed** (US-11): one Claude call per submission returns `{decision, reason, category}`. On a timeout or error the joke stays `pending` and a retry job rechecks it. Display names go through the same check.
- **Ranking** (US-10): eligible = approved, posted in the last rolling 24h, not JokeBot. Score = likes − dislikes; ties go to more total votes, then the earlier post. Fewer than 10 → fill from days 1–7 under "From this week". Cached for 60s.
- **Votes**: one per (joke, user), toggle or switch, no self-votes (API returns 403). Vote counts are never public; only the author sees their own counts, on `/me`.
- **Lists** (`/jokes`, `/u/[id]`) are lazy-loaded in batches of 20 with **cursor pagination** (not offset), so no duplicates or gaps appear while new jokes arrive. Each has a server-rendered first batch and a Load more fallback.
- **Auth boundary**: every reading page works logged out. Like, dislike, report and post open a sign-in dialog. Admins are the IDs in the `ADMIN_USER_IDS` env var; `/admin` returns 404 for everyone else.
- **JokeBot** is a system user whose daily joke goes through normal moderation and gets its own slot, never a top-10 rank.

## Hard rules

- Secrets (`ANTHROPIC_API_KEY`, Google OAuth) live only in `.env.local`.
- Tests never call the real Claude API or Google OAuth; mock both.
- No page or API response ever includes a user's email.
- No `any` without a comment explaining why.

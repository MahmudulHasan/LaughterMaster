# LaughterMaster: Build Plan

> Built from [SPEC.md](SPEC.md) v1.6. Each milestone is a small vertical slice.
> **Every milestone ends with:** `npm run check` green → spec review (`review-against-spec` skill) → commit → tick the boxes here.
> The "Course practice" line notes which SDLC skill each milestone exercises.

## Status

| Milestone | Stories | Status |
|-----------|---------|--------|
| M0 Foundations | – | Done |
| M1 Scaffold & CI | – | Done |
| M2 Sign in | US-1, US-2 | Done (live Google flow verified in M9) |
| M3 Post & view jokes | US-4, US-5, US-6, US-7, US-18 | Done |
| M4 Voting & top 10 | US-8, US-9, US-10 | Done |
| M5 Claude moderation | US-11, US-12, US-13 | Done |
| M6 Reports & admin | US-15, US-16, US-3 | Done |
| M7 Sharing | US-17 | Done (live preview check in M9) |
| M8 AI joke of the day | US-14 | Dropped |
| M9 Ship | NFRs | In progress |

**Why this order:** Sign-in comes first because posting, voting, and reports all depend on it. The core loop (post → vote → top 10) comes next, so the app is usable early. Moderation (M5) is the riskiest AI work and lands **before anything is deployed**: nothing goes public until M9, so the "public content is moderated" rule holds.

---

## M0: Foundations
**Course practice:** intent → spec → plan; setting up project context for AI.
- [x] Git repo + GitHub remote
- [x] `intent.md` from the brainstorm
- [x] `SPEC.md` v1.0 with user stories and acceptance criteria
- [x] `PLAN.md` (this file)
- [x] Project skills in `.claude/skills/` (product-owner, plan-milestones, implement-story, review-against-spec)
- [x] Author confirms or overrules the PO decisions D1–D14 in SPEC.md §9 (D3, D7, D8 changed)
- [x] Commit and push

**Exit:** the spec is confirmed and every open question has an answer.

## M1: Scaffold & CI
**Course practice:** environment setup, automated quality gates.
- [x] Next.js + TypeScript (strict) + Tailwind app (verified with `npm run build`)
- [x] ESLint + Prettier; `npm run check` = lint + format check + typecheck + test
- [x] Vitest + Testing Library configured with one sample test
- [x] Drizzle + PGlite wired up; first migration creates an empty schema
- [x] `.env.example` lists every required variable (no real values)
- [x] GitHub Actions runs `npm run check` on push and PR (run #1 green)

**Exit:** CI is green on `main` with an empty app.

## M2: Sign in (US-1, US-2)
**Course practice:** tackling a risky integration early; security-minded design; designing for testability.
- [x] Auth.js with the Google provider, active only when `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are set (the real client is created in M9, D15)
- [x] **Dev-only test sign-in** (D15): "Sign in as" a few seeded test users; registered only when running in development and Google isn't configured; never present in a production build
- [x] `users` table + migration; first sign-in creates a member profile from the provider's name and photo; later sign-ins update them
- [x] Session exposes only id, name and photo, never email
- [x] Header shows "Sign in", or the avatar + "Sign out"
- [x] Reusable sign-in dialog (title per action, Continue with Google, Not now; native modal so focus moves in, Escape closes, focus returns) opened by the header's Sign in and Post a joke; Like, Dislike and Report wire into it when they arrive (M3, M4, M6)
- [x] Sign-in returns to the page it started from; a cancelled or failed sign-in shows "Sign-in didn't finish. Try again."
- [x] Tests: dev sign-in is never registered in production or when Google is configured; user upsert; session has no email; home renders for a logged-out visitor (later reading pages add the same test as they land)

**Exit:** US-1 and US-2 criteria pass with the test sign-in and mocked OAuth. The live Google flow is verified in M9.

## M3: Post & view jokes (US-4, US-5, US-6, US-7, US-18)
**Course practice:** test-first from acceptance criteria.
- [x] `Joke` table + status field; jokes are auto-approved for now (moderation is added in M5, still local-only)
- [x] Post form: 10–500 characters after trimming, counted as Unicode graphemes (any language), with validation errors
- [x] Limit: 10 posts per member per 24h, with a "try again at …" message
- [x] `/joke/[id]` page; 404 page for unknown, deleted, or hidden jokes
- [x] Author can delete their own joke with a confirmation step
- [x] Cursor-based list API (`?cursor=` → 20 jokes + next cursor), with tests for no duplicates or gaps when new jokes arrive mid-scroll, and for the last batch
- [x] Shared lazy-list component: first batch server-rendered, auto-load near the end, Load more button fallback, skeletons, live-region announcements, Retry on error, end message
- [x] `/jokes` All jokes page using the lazy list; "All jokes" link in the header; Back from a joke restores the list and scroll position
- [x] `/u/[id]` profile: header (name, avatar, join month, joke count) + lazy list of the member's approved jokes; 404 for unknown members
- [x] Owner's view of their own profile shows their pending jokes marked "Under review"
- [x] Author names everywhere link to their profile
- [x] Test: profile and list responses never include an email or vote counts

**Exit:** US-4 through US-7 and US-18 pass, excluding moderation (M5), bans (M6), and the owner's `/me` and Edit name links (M4, M6).

## M4: Voting & top 10 (US-8, US-9, US-10)
**Course practice:** specifying and testing tricky business logic.
- [x] `Vote` table, unique per (joke, user)
- [x] Like/dislike toggling (add, switch, remove), with `aria-pressed`
- [x] Self-vote blocked in the UI and with a 403 from `POST /api/jokes/[id]/vote`
- [x] Ranking function: score, tie-breaks, 24h window, and 7-day fill under "From this week". Unit-tested with fixed clocks
- [x] Home page top 10 with ranks and an empty state (computed per request, not cached; the spec allows up to 60s staleness, so add caching in M9 if needed)
- [x] `/me` page with private counts per joke
- [x] Owner's profile links to `/me` (US-18, deferred from M3 because the page didn't exist)
- [x] Seed script with demo users and jokes for local testing (`npm run db:seed`, built during M3)

**Exit:** US-8 through US-10 pass; ranking has table-driven tests covering ties and boundaries.

## M5: Claude moderation (US-11, US-12, US-13)
**Course practice:** building an AI feature responsibly (prompts, evals, failure modes).
- [x] One Claude call returns structured JSON: `{ decision, reason, category, duplicate_of }` (`messages.parse` + Zod, effort `low`, 10s timeout)
- ~~Eval set run against the real API~~ dropped by the author (2026-11-24); moderation is covered by unit tests with a fake moderator
- [x] Rejected → friendly reason; timeout or error → `pending`, never public
- [x] Retry job for pending jokes (`npm run moderate:pending`; scheduled in M9)
- [x] Exact-duplicate check on normalized text; near-duplicate check via Claude against the 20 closest candidates (character trigrams)
- [x] Category chip shown on jokes
- [ ] Display names go through the same moderation (moved to M6 with US-3, where names become editable)
- [x] All tests mock the SDK
- [x] Development without an API key skips moderation; production fails closed (D17)
- [x] Admins' own jokes skip moderation and publish at once (SPEC 1.15, D19, 2026-11-27)

**Exit:** US-11 through US-13 pass with a fake moderator in tests.

## M6: Reports & admin (US-15, US-16, US-3)
**Course practice:** designing for misuse.
- [x] `Report` table, unique per (joke, user); members can't report their own jokes; 20 reports per member per 24h
- [x] 5 reports → hidden
- [x] Admins can delete any joke from its page (status `removed`; pulled forward from the queue at the author's request)
- [x] `/admin` queue (404 for non-admins): restore (clears reports), remove, ban (never an admin); Admin link in the header
- [x] Banned members can't post, vote, or report; their jokes are hidden and their profile returns 404 (US-18)
- [x] Display name change (US-3) — new names go through Claude moderation (moved from M5)
- [x] Owner's profile shows an "Edit name" link to the name form on `/me` (US-18, deferred from M3)
- [x] Session shows the new name right after a rename (re-read from the database on session update), and later sign-ins keep a chosen name

**Exit:** US-15, US-16, and US-3 pass.

## M7: Sharing (US-17)
**Course practice:** verifying in a real browser, not just in tests.
- [x] OG/Twitter meta tags on joke pages (`summary_large_image`; `metadataBase` from `SITE_URL`)
- [x] `next/og` 1200×630 image (`/joke/[id]/opengraph-image`) with truncation for long jokes; jokes in non-Latin scripts get a generic card (D18)
- [x] Share button on the joke page, lists and home: device share sheet, or copy link with a "Link copied" confirmation
- [x] Share menu: Facebook, WhatsApp, X, Copy link, plus the device share sheet where available (SPEC 1.13, 2026-11-24)
- [x] Bangla jokes and author names on the share card, shaped with HarfBuzz + Noto Sans Bengali; the whole joke fits, with smaller type for long ones (SPEC 1.14, D18, 2026-11-24)
- [ ] Manual check with a link-preview debugger once deployed (done in M9)

**Exit:** US-17 passes locally.

## M8: AI joke of the day (US-14): dropped
Dropped by the author on 2026-11-25 (SPEC v1.12). Nothing was built.

## M9: Ship
**Course practice:** release readiness, security review, deployment.
- [x] "Joke from the web" box on the home page from icanhazdadjoke.com, cached ~15 min, hidden when the source fails (US-19, D20, SPEC 1.16, 2026-11-27)
- [ ] Playwright smoke test: sign in (mocked) → post → vote → appears in the top 10 → share link
- [ ] Accessibility pass (keyboard + axe) and performance check against the NFRs
- [ ] `/security-review` and `review-against-spec` on the whole app
- [x] Create the Google OAuth client (project `laughtermaster`, client "LaughterMaster web (local)", External, testing mode) with the local redirect URL; ID and secret in `.env.local` (2026-11-25)
- [x] Add the production redirect URL (`https://laughter-master.vercel.app/api/auth/callback/google`) and put the ID and secret in Vercel (2026-11-24)
- [ ] Add a privacy policy page and publish the consent screen (D15); until then only Google test users can sign in
- [x] Verify the real Google sign-in locally (session holds only id, name and photo)
- [x] Verify the real Google sign-in when deployed (session holds only id, name and photo; production admin works)
- [ ] Revisit D16: return a real 404 status for unavailable jokes and profiles (e.g. a proxy check), or confirm the soft 404 is acceptable
- [x] DB factory picks hosted Postgres (node-postgres) when `DATABASE_URL` is set, PGlite otherwise; `npm run db:migrate` migrates either, and Vercel runs it before `next build` (`vercel-build`). Verified against a Postgres-protocol server (2026-11-24)
- [x] Vercel project `laughter-master` + Neon database `laughtermaster-db` (free, iad1, Marketplace integration, `DATABASE_` prefix); AUTH_SECRET (new, production-only), Google ID/secret and ADMIN_USER_IDS set in Vercel. Live at https://laughter-master.vercel.app (2026-11-24)
- [ ] Consider caching the home page ranking for up to 60s (US-10 allows it)
- [ ] Schedule `moderate:pending` (e.g. Vercel cron) and set `ANTHROPIC_API_KEY` in production
- [ ] Make the 10-posts-per-day check atomic with the insert (fine on single-connection PGlite, racy on hosted Postgres)
- [ ] Verify preview cards on real social platforms (`SITE_URL` now falls back to the Vercel production domain)
- [ ] README with setup, architecture, and a course retrospective

**Exit:** deployed, all Must stories pass, review findings resolved.

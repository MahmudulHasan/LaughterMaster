# LaughterMaster: Build Plan

> Built from [SPEC.md](SPEC.md) v1.4. Each milestone is a small vertical slice.
> **Every milestone ends with:** `npm run check` green → spec review (`review-against-spec` skill) → commit → tick the boxes here.
> The "Course practice" line notes which SDLC skill each milestone exercises.

## Status

| Milestone | Stories | Status |
|-----------|---------|--------|
| M0 Foundations | – | Done |
| M1 Scaffold & CI | – | Done |
| M2 Sign in | US-1, US-2 | Not started |
| M3 Post & view jokes | US-4, US-5, US-6, US-7, US-18 | Not started |
| M4 Voting & top 10 | US-8, US-9, US-10 | Not started |
| M5 Claude moderation | US-11, US-12, US-13 | Not started |
| M6 Reports & admin | US-15, US-16, US-3 | Not started |
| M7 Sharing | US-17 | Not started |
| M8 AI joke of the day | US-14 | Not started |
| M9 Ship | NFRs | Not started |

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
**Course practice:** tackling a risky integration early; security-minded design.
- [ ] Auth.js with the Google provider only (Google Cloud OAuth client for localhost)
- [ ] Sign-in dialog (title per action, Continue with Google, Not now; focus trap, Escape closes) opened by Like, Dislike, Report and Post a joke when logged out
- [ ] Test: every reading page (home, All jokes, joke page, profile) renders for a logged-out visitor
- [ ] `User` table; first sign-in creates a profile from the provider data
- [ ] Header shows "Sign in", or the avatar + "Sign out"
- [ ] Sign-in prompt for actions that need login, returning to the original page
- [ ] Test: no public API response or page contains the user's email

**Exit:** US-1 and US-2 criteria pass; OAuth is mocked in tests.

## M3: Post & view jokes (US-4, US-5, US-6, US-7, US-18)
**Course practice:** test-first from acceptance criteria.
- [ ] `Joke` table + status field; jokes are auto-approved for now (moderation is added in M5, still local-only)
- [ ] Post form: 10–500 characters after trimming, counted as Unicode graphemes (any language), with validation errors
- [ ] Limit: 10 posts per member per 24h, with a "try again at …" message
- [ ] `/joke/[id]` page; 404 page for unknown, deleted, or hidden jokes
- [ ] Author can delete their own joke with a confirmation step
- [ ] Cursor-based list API (`?cursor=` → 20 jokes + next cursor), with tests for no duplicates or gaps when new jokes arrive mid-scroll, and for the last batch
- [ ] Shared lazy-list component: first batch server-rendered, auto-load near the end, Load more button fallback, skeletons, live-region announcements, Retry on error, end message
- [ ] `/jokes` All jokes page using the lazy list; "All jokes" link in the header; Back from a joke restores the list and scroll position
- [ ] `/u/[id]` profile: header (name, avatar, join month, joke count) + lazy list of the member's approved jokes; 404 for unknown members
- [ ] Owner's view of their own profile shows their pending jokes marked "Under review"
- [ ] Author names everywhere link to their profile
- [ ] Test: profile and list responses never include an email or vote counts

**Exit:** US-4 through US-7 and US-18 pass (excluding the moderation and ban parts, which land in M5 and M6).

## M4: Voting & top 10 (US-8, US-9, US-10)
**Course practice:** specifying and testing tricky business logic.
- [ ] `Vote` table, unique per (joke, user)
- [ ] Like/dislike toggling (add, switch, remove), with `aria-pressed`
- [ ] Self-vote blocked in the UI and with a 403 from the API
- [ ] Ranking function: score, tie-breaks, 24h window, and 7-day fill under "From this week". Unit-tested with fixed clocks
- [ ] Home page top 10 with ranks and an empty state; cached for 60s
- [ ] `/me` page with private counts per joke
- [ ] Seed script with demo users and jokes for local testing

**Exit:** US-8 through US-10 pass; ranking has table-driven tests covering ties and boundaries.

## M5: Claude moderation (US-11, US-12, US-13)
**Course practice:** building an AI feature responsibly (prompts, evals, failure modes).
- [ ] One Claude call returns structured JSON: `{ decision, reason, category }`
- [ ] A small **eval set** (about 30 labeled jokes, good and bad, including several non-English ones) checks the prompt; run it manually and record the results
- [ ] Rejected → friendly reason; timeout or error → `pending`, never public
- [ ] Retry job for pending jokes
- [ ] Exact-duplicate check on normalized text; near-duplicate check via Claude against the 20 closest candidates
- [ ] Category chip shown on jokes
- [ ] Display names (US-3 prep) go through the same moderation
- [ ] All tests mock the SDK

**Exit:** US-11 through US-13 pass; the eval results are recorded in `docs/evals/moderation.md`.

## M6: Reports & admin (US-15, US-16, US-3)
**Course practice:** designing for misuse.
- [ ] `Report` table, unique per (joke, user); members can't report their own jokes
- [ ] 5 reports → hidden
- [ ] `/admin` queue (404 for non-admins): restore, remove, ban
- [ ] Banned members can't post, vote, or report; their jokes are hidden and their profile returns 404 (US-18)
- [ ] Display name change (US-3)

**Exit:** US-15, US-16, and US-3 pass.

## M7: Sharing (US-17)
**Course practice:** verifying in a real browser, not just in tests.
- [ ] OG/Twitter meta tags on joke pages
- [ ] `next/og` 1200×630 image with truncation for long jokes
- [ ] Share button: device share sheet, or copy link with a confirmation
- [ ] Manual check with a link-preview debugger once deployed (done in M9)

**Exit:** US-17 passes locally.

## M8: AI joke of the day (US-14)
**Course practice:** scheduled and automated AI behavior.
- [ ] JokeBot system user
- [ ] Generation job (locally a script; on Vercel a cron job at 08:00 UTC) that runs moderation and duplicate checks
- [ ] "AI joke of the day" slot with an AI badge, excluded from the top 10

**Exit:** US-14 passes.

## M9: Ship
**Course practice:** release readiness, security review, deployment.
- [ ] Playwright smoke test: sign in (mocked) → post → vote → appears in the top 10 → share link
- [ ] Accessibility pass (keyboard + axe) and performance check against the NFRs
- [ ] `/security-review` and `review-against-spec` on the whole app
- [ ] Vercel + hosted Postgres; secrets set in Vercel; OAuth callback URLs updated
- [ ] Verify preview cards on real social platforms
- [ ] README with setup, architecture, and a course retrospective

**Exit:** deployed, all Must stories pass, review findings resolved.

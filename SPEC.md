# LaughterMaster: Product Spec

> **Version 1.6** · 2026-11-22 · Owner: product owner (Claude, on the author's behalf)
> Derived from [`intent.md`](intent.md). Where this spec and intent.md disagree, intent.md wins until it's updated.
> All product decisions D1–D14 were reviewed and confirmed by the author on 2026-11-22 (see §9).

## 1. Product summary

LaughterMaster is a public community where people **post jokes**, **like or dislike** other people's jokes, and **share** their favorites. The home page shows the **top 10 jokes posted in the last 24 hours**, an **All jokes** page lists every joke, loading more as you scroll, and every member has a **profile** listing their jokes. Claude works behind the scenes as a **moderator, categorizer, and duplicate-catcher**, and posts one clearly labeled **AI joke of the day**.

**Why it exists:** a real project for practicing every stage of the AI-native SDLC (intent, spec, plan, build, test, review, ship). When learning and polish trade off, learning wins.

## 2. Roles

| Role | Who | Can do |
|------|-----|--------|
| Visitor | Anyone, not logged in | Browse, read jokes, share links |
| Member | Logged-in user | Everything a visitor can, plus post, vote, report, and delete their own jokes |
| Admin | Members listed in the `ADMIN_USER_IDS` config | Everything a member can, plus review reported jokes, restore or remove them, and ban members |
| JokeBot | System account | Posts the daily AI joke |

## 3. Success criteria (MVP)

1. A first-time visitor sees a full home page (10 jokes, or fewer only if fewer than 10 exist in the last 7 days) within **2 seconds** on a local production build.
2. A new user can **sign in, post a joke, and see it live** in under **60 seconds**.
3. **100%** of jokes that are visible publicly have passed Claude's moderation check.
4. Every **Must** story's acceptance criteria have an automated test that passes in CI.

## 4. User stories

Priorities use MoSCoW: **M**ust, **S**hould, **C**ould. Acceptance criteria use Given / When / Then.

### Epic A: Accounts

**US-1 · Sign in · M**
As a visitor, I want to sign in with my Google account, so that I can like, dislike and post without creating a new password. _(intent #2)_
- **Google is the only sign-in method.** There are no passwords and no other providers.
- **Development only:** while running locally without a Google client configured, the sign-in dialog also offers "Sign in as" a few seeded test users. It is a development tool, not a sign-in method, and is never available in a production build. _(D15)_
- Given I'm logged out, when I click "Sign in", then I see one "Continue with Google" button, and after approving with Google I return to the page I was on.
- Given I cancel or Google returns an error, then I'm back on the page I was on, still logged out, with a short "Sign-in didn't finish. Try again." message.
- Given I sign in for the first time, then a member profile is created with my Google display name and profile photo.
- Given I'm signed in, when I click "Sign out", then I'm logged out and can still browse.
- My email address is **never** shown on any page or returned by any public API.

**US-2 · Logged-out prompts · M**
As a visitor, I want a clear prompt when I try something that needs an account, so that I know why I can't do it.
- Given I'm logged out, then I can see and read every page that lists jokes: home, All jokes, joke pages and profiles. Reading never asks me to sign in.
- Given I'm logged out, then the Like, Dislike and "Post a joke" controls are still visible (not hidden or greyed out), so I can discover them.
- Given I'm logged out, when I click Like, Dislike, Report, or "Post a joke", then a sign-in dialog opens with a title naming the action ("Sign in to like jokes"), a "Continue with Google" button, and "Not now". Nothing is saved.
- The dialog is a real modal: focus moves into it, Escape and "Not now" close it, and focus returns to the button that opened it.
- After I sign in from that prompt, I return to the same page. (The action itself isn't replayed automatically.)

**US-3 · Display name · S**
As a member, I want to change my display name, so that I choose how I'm credited.
- A name must be 2–30 characters. Letters, numbers, spaces, `_`, and `-` are allowed. Claude's moderation applies to names too.

### Epic B: Posting jokes

**US-4 · Post a joke · M**
As a member, I want to post a joke, so that other people can enjoy and vote on it.
- Given I'm signed in, when I submit text of **10–500 characters**, then it is screened (US-11), and if it's approved it appears on its own page and in the "New" feed.
- Given the text is shorter than 10 or longer than 500 characters, then I see a validation error and nothing is saved. Whitespace is trimmed before counting.
- Given I've already posted **10 jokes in the last 24 hours**, when I try to post another, then I'm told when I can post again. _(D8)_
- Jokes can be in **any language**. The 10–500 limit counts characters as people see them (Unicode graphemes), so emoji and non-Latin scripts count fairly. The interface itself stays English-only. _(D7)_

**US-5 · No edits, but delete · M**
As a member, I want to delete my own joke, so that I can remove something I regret. Editing is not allowed, because edits could change a joke after it has collected votes.
- Given I'm the author, when I delete my joke and confirm, then it disappears everywhere, including the top 10, and its votes no longer count.
- Members can't delete other members' jokes.

**US-6 · Joke page · M**
As anyone, I want each joke to have its own page, so that it can be linked and shared.
- `/joke/<id>` shows the joke, the author's display name and avatar, its category, a relative post time ("3h ago"), the vote buttons, and the share controls.
- A deleted, hidden, or unknown joke shows a friendly "This joke isn't available" page that search engines are told not to index (`noindex`). _(D16)_

**US-7 · All jokes page · M** _(intent #13)_
As anyone, I want to browse every joke ever posted, so that I can find more than today's top 10 and fresh jokes get votes.
- `/jokes` lists all **approved** jokes from everyone, **newest first**, **loaded lazily in batches of 20**. _(intent #13)_
- Given I open the page, then the first 20 jokes are rendered by the server, so the page works before any script runs.
- Given I scroll to within about one screen of the end, then the next 20 load automatically and are added below. **No duplicates or gaps**, even if new jokes are posted while I scroll (the list pages by cursor, not by offset).
- A visible **"Load more jokes"** button is always present below the list as the fallback for keyboard and screen-reader users, and if automatic loading fails.
- While a batch loads, 2 skeleton cards are shown, and a polite live region announces "Loading more jokes…" and then "20 more jokes loaded".
- Given a batch fails to load, then I see "Couldn't load more jokes" with a **Retry** button, and the jokes already shown stay.
- Given there are no more jokes, then automatic loading stops and I see "You've seen every joke" with a "Post the next one" button.
- Given I open a joke and press Back, then the list returns with the jokes I'd loaded and my scroll position. _(confirmed, see §9)_
- Given there are no approved jokes, then I see the same empty state as the home page, with a "Post a joke" button.
- Pending, rejected, hidden, removed, and deleted jokes never appear. The daily AI joke **does** appear, with its AI badge.
- Each entry shows the joke, the author (linked to their profile), the category, the relative post time, and the vote and share controls. No vote counts are shown (intent #5).
- The header has an "All jokes" link on every page.

**US-18 · Member profile · M** _(intent #12)_
As anyone, I want to see a member's profile with all their jokes, so that I can read more from authors I like.
- Every member has a public profile at `/u/<id>`, showing their display name, avatar, "Joined <month year>", and their number of approved jokes.
- It lists **all of the member's approved jokes**, newest first, loaded lazily with the same rules as US-7 (batches of 20, Load more fallback, end message).
- The author name on every joke (home, all jokes, joke page) links to the author's profile.
- Given a member has no approved jokes, the profile says "<name> hasn't posted any jokes yet."
- Given the member doesn't exist or is banned, then I see "This profile isn't available", marked `noindex`. _(D16)_
- **Viewing my own profile:** I see the same public list, plus an "Edit name" link (US-3) and a link to `/me` for my private stats (US-9). My pending jokes appear only to me, marked "Under review". _(confirmed, see §9)_
- The profile never shows email, vote counts, or what the member has voted on. _(confirmed, see §9)_
- JokeBot has a profile too, listing all of its daily AI jokes.

### Epic C: Voting & ranking

**US-8 · Like / dislike · M**
As a member, I want to like or dislike a joke, so that the best jokes rise.
- Each member has at most **one vote per joke**: like, dislike, or none.
- Clicking the same button again **removes** my vote. Clicking the other button **switches** it.
- I **can't vote on my own joke**: the buttons are disabled with the tooltip "You can't vote on your own joke", and the API rejects the vote with HTTP 403.
- My current vote is shown as a highlighted button.
- Vote **counts are not shown publicly**. **(intent #5)**

**US-9 · Author stats · S**
As an author, I want to see how my jokes are doing, so that posting feels rewarding.
- On "My jokes" (`/me`), I see each of my jokes with its likes, dislikes, and score. No one else sees these numbers. _(confirmed, see §9)_

**US-10 · Top 10 of the day · M**
As anyone, I want the home page to show the 10 best jokes from the last 24 hours, so that I get the best laughs fast.
- **Eligible:** approved, not hidden or deleted, **posted within the last rolling 24 hours**, and not posted by JokeBot.
- **Score** = likes − dislikes. **(intent #4)**
- **Tie-breaks:** (1) more total votes ranks higher, then (2) the earlier post ranks higher. Rewarding the earlier post means copycats can't win ties. _(confirmed, see §9)_
- **Cold start (intent #9):** if fewer than 10 jokes are eligible, fill the remaining slots with the best jokes posted 1–7 days ago, using the same scoring. They appear under a separate "From this week" heading.
- If there are no jokes at all, show an empty state that says "No jokes yet. Be the first!", with a "Post a joke" button.
- The ranking can be up to **60 seconds** stale (it's cached).
- Each entry shows its rank (#1–#10), the joke, the author, the category, and the vote and share controls.

### Epic D: Claude as helper

**US-11 · AI moderation on submit · M**
As the community, I want harmful content blocked before it's public, so that the site stays welcoming.
- Every submitted joke (and every display name, per US-3) is sent to Claude **before it becomes visible**. Moderation must work for jokes in **any language** (D7); the rejection reason is shown in English.
- **Blocked categories:** hate or harassment targeting protected groups or real private people, sexual content, graphic violence, self-harm encouragement, spam, ads, and links.
- When a joke is **rejected**, the author sees a short, non-judgmental reason ("This looks like it targets a group of people"), and the joke isn't saved publicly.
- If Claude is **unavailable** or times out (after 10 seconds), the joke is saved as **pending** and the author is told "We're checking your joke. It'll appear shortly." A retry job screens pending jokes. **Pending jokes are never public (fail closed).**
- The decision, category, and model version are stored with the joke for auditing.

**US-12 · Auto-categorize · S**
As a reader, I want jokes tagged by category, so that I can find the kind of humor I like.
- The same Claude call that moderates a joke also assigns exactly one category from a fixed list: **Puns, Dad jokes, One-liners, Tech, Animals, Wordplay, Knock-knock, Other**. _(confirmed, see §9)_
- The category shows as a chip on every joke. Category names stay in English whatever the joke's language.

**US-13 · Duplicate detection · S**
As the community, I want reposted jokes blocked, so that nobody farms votes with other people's jokes.
- **Exact duplicate:** text that matches an existing approved joke after normalizing (lowercase, collapsed whitespace, punctuation removed) is rejected, with a link to the original. _(confirmed, see §9)_
- Duplicates are checked within the same language; a translation of an existing joke is not treated as a duplicate.
- **Near duplicate:** if Claude judges a joke to be the same joke as one of the 20 most similar existing jokes, the post is rejected the same way. The threshold can be tuned later.

**US-14 · AI joke of the day · S**
As a visitor, I want a daily AI joke, so that there's always something to laugh at.
- Once a day at 08:00 UTC, JokeBot posts one family-friendly joke. It goes through the same moderation and duplicate checks.
- It's shown in a separate **"AI joke of the day"** slot above the top 10, with an "AI" badge. **It doesn’t compete in the top 10.** _(confirmed, see §9)_
- Members can vote on it and share it like any other joke.

### Epic E: Safety & moderation

**US-15 · Report a joke · M**
As a member, I want to report a joke that slipped through, so that the community can fix moderation misses.
- Each member can report a joke once, choosing a reason: Offensive, Spam, Plagiarized, or Other.
- When **5 different members** report a joke, it's **hidden** automatically until an admin reviews it. _(D3)_
- Members can't report their own jokes.

**US-16 · Admin review queue · M**
As an admin, I want to review hidden and pending jokes, so that I can make the final call.
- `/admin` is visible only to admins; everyone else gets a 404.
- It lists hidden and pending jokes with their reports and Claude's decision. For each one I can **Restore** or **Remove**.
- I can **ban** a member. A banned member can't post, vote, or report, and their existing jokes are hidden.

### Epic F: Sharing

**US-17 · Share with preview cards · M**
As anyone, I want shared links to look good on social media, so that friends click them.
- Every joke page has Open Graph and Twitter Card tags, plus a generated **1200×630 image** showing the joke text, the author's name, and the LaughterMaster brand. Long jokes are truncated with "…".
- A "Share" button opens the device's share sheet where available, and otherwise copies the link and shows a "Link copied" confirmation.

## 5. Non-functional requirements

| Area | Requirement |
|------|-------------|
| Safety | Public content must pass moderation (US-11), and moderation fails closed. |
| Abuse | Rate limits: 10 posts per member per 24h, 300 votes per member per hour, 20 reports per member per day. |
| Privacy | Only the display name and avatar are public. Emails are never exposed. |
| Secrets | `ANTHROPIC_API_KEY` and the OAuth secrets live only in `.env.local` (and the host's secret store). They're never committed and never sent to the browser. |
| Cost | Claude calls use a small, fast model (Haiku class) and are capped at about 2 calls per submitted joke. |
| Performance | Home page LCP under 2s on a local production build; top-10 query under 100ms with 10k jokes. |
| Accessibility | WCAG 2.1 AA: every action is keyboard-usable, focus is visible, vote buttons have labels and `aria-pressed`. |
| Testing | No real Claude or OAuth calls in automated tests. CI runs lint, typecheck, unit tests, and one end-to-end smoke test. |

## 6. Data model (draft; engineering may refine)

```
User    { id, displayName, avatarUrl, email (private), isBanned, createdAt }
Joke    { id, authorId, text, normalizedText, category,
          status: pending | approved | rejected | hidden | removed | deleted,
          moderation: { decision, reason, model, checkedAt },
          isBot, createdAt }
Vote    { jokeId, userId, value: +1 | -1, updatedAt }       unique(jokeId, userId)
Report  { jokeId, userId, reason, createdAt }                 unique(jokeId, userId)
```

## 7. Proposed tech stack (for engineering to confirm)

Next.js (App Router) + TypeScript + Tailwind · Auth.js (Google provider only) · Postgres via Drizzle ORM (PGlite locally and in tests, hosted Postgres when deployed) · Anthropic TypeScript SDK · `next/og` for preview images · Vitest + Testing Library + Playwright · GitHub Actions CI · Vercel (deployed in the final milestone, intent #11).

## 8. Out of scope

Comments, following or feeds, notifications, usernames/handles, profile bios or custom avatars, searching jokes, editing jokes, translating jokes, a non-English interface, images or memes in jokes, per-platform share buttons, a public leaderboard of users, monetization, mobile apps, and the old Claude joke generator.

## 9. Decision log

Decisions from intent.md are final unless the author changes them. All PO proposals below were reviewed by the author on 2026-11-22: **Confirmed** = accepted as proposed, **Changed** = the author chose differently.

| # | Question | Decision | Source |
|---|----------|----------|--------|
| D1 | Do authors see their own counts? | Yes, privately on `/me`. Public sees no counts. | Confirmed |
| D2 | Tie-breaks | More total votes, then the earlier post | Confirmed |
| D3 | Report threshold | **5** distinct members hide a joke (proposed: 3) | **Changed** |
| D4 | Who is admin | Member IDs listed in the `ADMIN_USER_IDS` env var | Confirmed |
| D5 | Duplicates | Block exact and near duplicates, with a link to the original | Confirmed |
| D6 | Does the bot joke compete? | No; it has its own slot | Confirmed |
| D7 | Joke rules | 10–500 characters, **any language** (proposed: English only), no edits, the author can delete | **Changed** |
| D8 | Post rate limit | **10** jokes per member per 24h (proposed: 5) | **Changed** |
| D9 | Categories | A fixed list of 8; no category filter on the top 10 in the MVP | Confirmed |
| D10 | Public profile info | Display name + avatar only | Confirmed |
| D11 | Moderation outage | Fail closed: jokes stay pending and are retried | Confirmed |
| D12 | All jokes page and profile lists | Lazy loading (intent #13): newest first, batches of 20, auto-load plus Load more, cursor-based. Back restores the list and scroll position. | Confirmed |
| D13 | What a profile shows | Name, avatar, join month, joke count, approved jokes. Never email, votes cast, or vote counts. The owner also sees their own pending jokes. | Confirmed |
| D14 | Profile URL | `/u/<id>`. Usernames or handles are out of scope for the MVP. | Confirmed |
| D15 | When the Google OAuth client is created | Deferred to M9. Until then, development uses a dev-only test sign-in and tests mock OAuth. The real Google flow is first exercised in M9. | Author |
| D16 | Status of "isn't available" pages | Unavailable joke and profile pages show the friendly message with a `noindex` tag but keep HTTP status 200. With Next.js Cache Components the page shell (and its 200 status) is sent before the database lookup; a real 404 would need a per-request Proxy lookup, which isn't worth it. People see no difference. `/admin` (served by its own check) is unaffected. | Author |

## Changelog

- **1.6** (2026-11-22): Added D16: unavailable joke and profile pages use `noindex` with status 200 instead of HTTP 404 (US-6, US-18). Affects M3.
- **1.5** (2026-11-22): Added D15: the Google OAuth client is created in M9; development uses a dev-only test sign-in, never in production (note on US-1). Affects M2 and M9.
- **1.4** (2026-11-22): Author reviewed all PO decisions. Confirmed D1, D2, D4–D6, D9–D14. Changed D3 (report threshold 3 → 5), D7 (any language instead of English only) and D8 (post limit 5 → 10 per 24h). Moderation, categorizing and duplicate checks now must handle any language. Affects milestones M3, M5 and M6.
- **1.3** (2026-11-22): Google is the only sign-in method (intent #2, author decision). US-1 drops GitHub and adds a sign-in failure criterion; US-2 states that reading never needs a login, keeps action buttons visible to visitors, and defines the sign-in dialog. Affects milestone M2.
- **1.2** (2026-11-22): Switched US-7 and US-18 from numbered pagination to lazy loading, per the author after the design review. Added loading, error, end, accessibility and Back-button criteria; updated D12. Affects milestone M3.
- **1.1** (2026-11-22): Added US-18 (member profile, intent #12). Rewrote US-7 from a "New feed" with Load more into an "All jokes" page with numbered pagination, and raised it from Should to Must (intent #13). Added PO decisions D12–D14. Affects milestone M3.
- **1.0** (2026-11-22): Rewritten from intent.md for the community joke platform. Replaces draft v0.1 (random jokes + Claude generator).

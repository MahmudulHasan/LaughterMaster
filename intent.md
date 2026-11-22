# LaughterMaster: Intent

> Why we're building this and what it should be, before any spec details.
> Captured through a Q&A brainstorm on 2026-11-22. This replaces the earlier random-joke/generator idea; `SPEC.md` will be rewritten from this file.

## The idea (in the author's words)

A platform where people can post jokes. The home page shows the **top 10 jokes of the day**.
People can **like** jokes they enjoy and **dislike** jokes they don't. People can **share** jokes on social media.

_Added later:_ Each person has a **profile** where all of their jokes are shown. **All the posted jokes from everyone** are shown, with pagination, on another page.

## Why

- **Primary goal:** finish the AI-native SDLC playbook course by taking one real project through every stage: intent, spec, plan, build, test, review, ship.
- Polish and real users are nice to have, not goals. When a choice trades course learning against product polish, choose learning.

## Decisions

| # | Topic | Decision |
|---|-------|----------|
| 1 | Audience | The **general public**. Anyone on the internet can visit, so moderation and anti-cheating are required, not optional. |
| 2 | Accounts | **The public can see and read every joke without logging in.** Liking, disliking and posting need a login, and **Google is the only sign-in method**. |
| 3 | "Of the day" | Jokes **posted in the last rolling 24 hours** compete for the top 10. |
| 4 | Ranking | **Score = likes − dislikes.** Simple and explainable. Known trade-off: a joke at 1/0 ties one at 51/50. |
| 5 | Voting rules | A user can **change or undo** their vote. Users **cannot vote on their own jokes**. Like and dislike counts are **not shown publicly** (only the ranking). |
| 6 | Moderation | **Claude screens every joke on submit** and blocks clear violations (hate, harassment, sexual content, spam). Users can **report** a joke; after N reports it is hidden until an admin reviews it. |
| 7 | Claude's other jobs | **Auto-categorize** jokes (pun, dad joke, tech, …) for filtering. **Detect duplicates** so reposts can't farm votes. Post one **daily bot joke**, clearly labeled as AI. |
| 8 | Sharing | **Preview image cards** (Open Graph) so shared links look good on X, WhatsApp, Facebook, etc. This implies each joke has its **own page/URL**. |
| 9 | Cold start | If fewer than 10 jokes were posted in the last 24h, **fill the rest with the top jokes of the last 7 days**, clearly labeled. |
| 10 | vs old spec | This **replaces** the old LaughterMaster spec. The random-joke browser and the Claude joke generator are dropped. |
| 11 | Deployment | **Local first, deploy later:** build and test locally, then deploy to Vercel + a hosted database (e.g. Postgres) in the final milestone. |
| 12 | Profiles | Every member has a **public profile page** that lists **all of their jokes**. |
| 13 | All jokes page | A separate page lists **every posted joke from everyone**, **loaded lazily**: more jokes load as you scroll. Profiles load the same way. |

## Open questions (for the spec stage)

- **Counts vs ranking:** Does the joke author see their own joke's counts? Do voters see anything beyond their own vote?
- **Ties:** with likes − dislikes, ties will be common. Break them by newest first? Most total votes?
- **Report threshold:** how many reports (N) hide a joke? Who is the admin, and what admin screen is needed?
- **Duplicates:** block a duplicate outright, or allow it but keep it out of the top 10?
- **Bot joke:** does the daily AI joke compete in the top 10, or sit in its own slot?
- **Joke rules:** max length, language(s), and whether edits are allowed after posting (edits could game votes).
- **Rate limits:** how many jokes per user per day?
- **Categories:** a fixed list or open-ended? Can users filter the top 10 by category?
- **Privacy:** what profile info is shown publicly (display name only)?

## Out of scope (for now)

Comments, follower feeds, notifications, mobile apps, monetization, per-platform share buttons, and the old Claude joke generator.

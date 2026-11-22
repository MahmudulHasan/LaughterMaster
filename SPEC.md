# LaughterMaster: Product Spec

> Status: **Draft v0.1**. Review and edit this before any code gets written.
> This spec is the source of truth. If code and spec disagree, update one of them on purpose.

## 1. Problem & goal

People want a quick laugh tailored to their mood or a topic, and a way to save the jokes they like.
LaughterMaster is a small web app where you **pick a topic and style, get jokes (some written by Claude), rate them, and keep favorites**.

**Learning goal:** a realistic but small codebase for practicing the AI-native SDLC: spec, plan, build in small steps, test, review, and ship.

## 2. Users

- **Casual visitor:** wants a joke in under 5 seconds with no sign-up.
- **Returning fan:** saves favorites and wants to see them again later.

## 3. Features (MVP)

| ID | Feature | Acceptance criteria |
|----|---------|---------------------|
| F1 | Random joke | The home page shows a joke from a seeded local library. A "Next" button loads a different joke, never the same one twice in a row. |
| F2 | Browse by category | The user can filter by category (puns, dad jokes, tech, animals, wordplay). An empty category shows a friendly message. |
| F3 | AI joke generator | The user enters a topic (1–60 chars) and picks a style. The server calls the Claude API and returns 1 joke. Shows a loading state; errors show a retry button; the API key never reaches the browser. |
| F4 | Rate jokes | Thumbs up/down on any joke. Each joke shows its score. One vote per joke per browser. |
| F5 | Favorites | Star a joke to save it; a Favorites page lists saved jokes. Saved jokes survive a page reload. |
| F6 | Share | "Copy" button copies the joke text to the clipboard and confirms. |

## 4. Out of scope (for MVP)

User accounts and login, comments, image or meme generation, moderation dashboard, mobile app.

## 5. Non-functional requirements

- **Content safety:** AI jokes must be family-friendly. The system prompt enforces this, and the topic input is length-limited and validated server-side.
- **Cost control:** Rate-limit the AI endpoint (e.g. 10 requests/min per IP). Use a small, fast Claude model.
- **Performance:** Home page interactive in under 2s on a normal connection.
- **Accessibility:** Keyboard-usable, visible focus, labeled controls, AA contrast.
- **Secrets:** `ANTHROPIC_API_KEY` only in `.env.local`, never committed.

## 6. Tech stack

- Next.js (App Router) + TypeScript + React
- Tailwind CSS
- SQLite via Prisma or Drizzle for jokes and ratings (localStorage for favorites in MVP)
- Anthropic TypeScript SDK for F3
- Vitest + React Testing Library for unit/component tests; Playwright for one end-to-end smoke test
- ESLint + Prettier; GitHub Actions CI (lint, typecheck, test)

## 7. Data model (draft)

```
Joke   { id, text, category, source: "seed" | "ai", createdAt }
Vote   { id, jokeId, clientId, value: +1 | -1, createdAt }   // unique (jokeId, clientId)
```

## 8. Open questions

- [ ] Should AI-generated jokes be saved to the library automatically, or only when the user rates or favorites them?
- [ ] Do we need a "report this joke" button for MVP?
- [ ] Deploy target: Vercel, or local-only?

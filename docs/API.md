# LaughterMaster API

The HTTP API behind [laughter-master.vercel.app](https://laughter-master.vercel.app). The site's own pages use it to load jokes, vote, and build share previews.

> **Status:** unversioned and built for the LaughterMaster web app. Endpoints may change without notice. There are no API keys, and cross-origin browser requests aren't allowed (no CORS headers), so browser use is same-site only. Server-to-server reads of the public endpoints work.

- **Base URL:** `https://laughter-master.vercel.app` (locally `http://localhost:3000`)
- **Format:** JSON in and out, UTF-8. Joke text can be in any language.
- **Source of truth:** the route handlers in [`src/app/api/`](../src/app/api) and the types in [`src/server/jokes/types.ts`](../src/server/jokes/types.ts). Product rules come from [`SPEC.md`](../SPEC.md).

## Contents

- [Authentication](#authentication)
- [Conventions](#conventions)
- [Objects](#objects)
- [Endpoints](#endpoints)
  - [List jokes](#list-jokes): `GET /api/jokes`
  - [List a member's jokes](#list-a-members-jokes): `GET /api/users/{userId}/jokes`
  - [Vote on a joke](#vote-on-a-joke): `POST /api/jokes/{jokeId}/vote`
  - [Share card image](#share-card-image): `GET /joke/{jokeId}/opengraph-image`
  - [Session and sign-in](#session-and-sign-in): `/api/auth/*`
- [Actions that aren't HTTP endpoints](#actions-that-arent-http-endpoints)
- [Limits and rules](#limits-and-rules)
- [Changelog](#changelog)

## Authentication

Reading is open to everyone. Voting needs a signed-in member.

Members sign in with **Google** through [Auth.js](https://authjs.dev) (see [Session and sign-in](#session-and-sign-in)). The session is a signed, `HttpOnly` cookie (`__Secure-authjs.session-token` on HTTPS), so a browser on the site sends it automatically. There are no bearer tokens or API keys.

The member is always taken from the session, never from the request body or query, so one member can't act as another.

## Conventions

| Topic | Rule |
|---|---|
| IDs | Opaque strings, at most 200 characters. Don't parse them. |
| Timestamps | ISO 8601 in UTC, e.g. `2026-11-24T16:41:16.660Z`. |
| Errors | JSON `{ "error": "<code>" }` with a matching HTTP status. Codes are listed per endpoint. |
| Caching | API responses send `Cache-Control: private, no-store`: they depend on who is asking (`myVote`). |
| Visibility | Only **approved** jokes by members who aren't banned are public. Pending, rejected, hidden, removed and deleted jokes never appear, except that the author sees their own pending jokes in their own list. |
| Privacy | No response ever includes an email address or vote counts. |

## Objects

### Joke

```json
{
  "id": "4f2c9a1e-7b3d-4e8a-9c21-5d6f7a8b9c0d",
  "text": "I told my Wi-Fi we needed to talk. It said \"connection unstable\" and left the room.",
  "status": "approved",
  "author": {
    "id": "a1b2c3d4-0000-4000-8000-000000000001",
    "displayName": "Mina Park",
    "avatarUrl": "https://lh3.googleusercontent.com/a/example=s96-c"
  },
  "createdAt": "2026-11-24T16:41:16.660Z",
  "isBot": false,
  "category": "Tech",
  "myVote": 1
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Joke ID. The joke's page is `/joke/{id}`. |
| `text` | string | 10–500 characters (counted as user-perceived characters, so an emoji or a Bangla letter with its vowel sign counts once). Line breaks are kept. |
| `status` | string | `approved` in public lists. `pending` appears only in the author's own list (waiting for moderation). |
| `author` | [Member](#member) | |
| `createdAt` | string | When it was posted. |
| `isBot` | boolean | Always `false` (bot jokes were dropped from the product). |
| `category` | string \| null | One of `Puns`, `Dad jokes`, `One-liners`, `Tech`, `Animals`, `Wordplay`, `Knock-knock`, `Other`, set by moderation. `null` when a joke was published by hand. |
| `myVote` | `1` \| `-1` \| `null` | **Only for signed-in callers:** your own vote on this joke (like `1`, dislike `-1`, none `null`). Missing for anonymous callers. |

### Member

| Field | Type | Notes |
|---|---|---|
| `id` | string | Member ID. The profile page is `/u/{id}`. |
| `displayName` | string | Public name, any script. |
| `avatarUrl` | string \| null | Profile photo URL (Google), or `null`. |

### JokePage

One batch of a list. Lists are newest first, 20 jokes per batch.

| Field | Type | Notes |
|---|---|---|
| `jokes` | [Joke](#joke)[] | Up to 20 jokes. |
| `nextCursor` | string \| null | Pass it as `?cursor=` to get the next batch. `null` means you've reached the end. |

**Why cursors, not page numbers:** new jokes arrive all the time. With page numbers, a new joke would push everything down, and you'd see a joke twice or skip one. A cursor marks the last joke you've seen, so the next batch always continues from there. Treat cursors as opaque: their content may change.

## Endpoints

### List jokes

`GET /api/jokes`

All approved jokes, newest first, in batches of 20 (the All jokes page).

**Query parameters**

| Name | Required | Description |
|---|---|---|
| `cursor` | No | `nextCursor` from the previous batch. Leave it out (or empty) for the first batch. |

**Example**

```bash
curl https://laughter-master.vercel.app/api/jokes
```

```json
{
  "jokes": [
    {
      "id": "4f2c9a1e-7b3d-4e8a-9c21-5d6f7a8b9c0d",
      "text": "আমার ডায়েট খুব ভালোভাবেই চলছে। সমস্যা একটাই, খাবারগুলো ডায়েট মানছে না।",
      "status": "approved",
      "author": { "id": "a1b2c3d4-0000-4000-8000-000000000001", "displayName": "Mina Park", "avatarUrl": null },
      "createdAt": "2026-11-24T16:41:16.660Z",
      "isBot": false,
      "category": "One-liners"
    }
  ],
  "nextCursor": "eyJjcmVhdGVkQXQiOiIyMDI2LTExLTI0VDE2OjQxOjE2LjY2MDEyM1oiLCJpZCI6IjRmMmM5YTFlLTdiM2QtNGU4YS05YzIxLTVkNmY3YThiOWMwZCJ9"
}
```

Next batch:

```bash
curl "https://laughter-master.vercel.app/api/jokes?cursor=eyJjcmVhdGVkQXQiOiIy..."
```

**Responses**

| Status | Body | When |
|---|---|---|
| 200 | [JokePage](#jokepage) | Always, for a valid request. An empty `jokes` array with `nextCursor: null` means there's nothing (more) to show. |
| 400 | `{ "error": "invalid_cursor" }` | The cursor isn't one the API issued. (It's an error rather than an empty page, so a broken cursor never looks like the end of the list.) |

### List a member's jokes

`GET /api/users/{userId}/jokes`

One member's jokes, newest first, in batches of 20 (the profile page `/u/{userId}`). Approved jokes for everyone; **the member themself also gets their own pending jokes** (`status: "pending"`).

**Path and query parameters**

| Name | In | Required | Description |
|---|---|---|---|
| `userId` | path | Yes | Member ID. |
| `cursor` | query | No | As for [List jokes](#list-jokes). |

**Example**

```bash
curl https://laughter-master.vercel.app/api/users/a1b2c3d4-0000-4000-8000-000000000001/jokes
```

**Responses**

| Status | Body | When |
|---|---|---|
| 200 | [JokePage](#jokepage) | The member exists and isn't banned. |
| 400 | `{ "error": "invalid_cursor" }` | Bad cursor. |
| 404 | `{ "error": "not_found" }` | No such member, or the member is banned. |

### Vote on a joke

`POST /api/jokes/{jokeId}/vote`

Like or dislike a joke as the signed-in member. Each member has at most one vote per joke:

| Your current vote | You send | Result |
|---|---|---|
| none | `1` or `-1` | That vote is saved. |
| `1` | `1` | Vote removed (toggle off). |
| `1` | `-1` | Switched to dislike. |
| `-1` | `-1` | Vote removed. |
| `-1` | `1` | Switched to like. |

Vote totals are never returned, to anyone. The author sees their own joke's totals only on their private `/me` page.

**Request**

- Requires a session cookie.
- Body (JSON): `{ "value": 1 }` to like, `{ "value": -1 }` to dislike.

```bash
curl -X POST https://laughter-master.vercel.app/api/jokes/4f2c9a1e-7b3d-4e8a-9c21-5d6f7a8b9c0d/vote \
  -H "Content-Type: application/json" \
  -H "Cookie: __Secure-authjs.session-token=<your session cookie>" \
  -d '{"value": 1}'
```

**Responses**

| Status | Body | When |
|---|---|---|
| 200 | `{ "myVote": 1 }`, `{ "myVote": -1 }` or `{ "myVote": null }` | Your vote after the change. |
| 400 | `{ "error": "bad_request" }` | The body isn't `{ "value": 1 }` or `{ "value": -1 }`, or the ID is too long. |
| 401 | `{ "error": "not_signed_in" }` | No valid session, or your account is banned. |
| 403 | `{ "error": "own_joke" }` | You can't vote on your own joke. |
| 404 | `{ "error": "not_found" }` | No such joke, or it isn't public (pending, hidden, removed, or its author is banned). |

The sign-in check comes first, so an anonymous caller gets `401` even for a joke that doesn't exist.

### Share card image

`GET /joke/{jokeId}/opengraph-image`

The 1200×630 PNG preview shown when a joke link is shared (Facebook, WhatsApp, X and others). You rarely call it directly: each joke page links it in its `og:image` and `twitter:image` tags, with a version suffix (`?<hash>`).

- **English and other Latin-script jokes:** the joke text, sized so the whole joke fits.
- **Bangla jokes:** the joke text too, correctly shaped (conjuncts, vowel signs). Emoji are left out of the image.
- **Other scripts** (Hindi, Arabic, Korean, …): a branded card saying "Open the link to read this joke."
- **Unknown or non-public jokes:** a generic LaughterMaster card. The response is still `200 image/png`, so it never reveals whether a hidden joke exists.

```bash
curl -o card.png https://laughter-master.vercel.app/joke/4f2c9a1e-7b3d-4e8a-9c21-5d6f7a8b9c0d/opengraph-image
```

### Session and sign-in

These endpoints come from Auth.js. The site's own pages use them; they're listed here so you know what exists.

| Method and path | What it does |
|---|---|
| `GET /api/auth/session` | The current session: `{ "user": { "id", "name", "image" }, "expires" }`, or `null` when signed out. Never includes email. |
| `GET /api/auth/providers` | Available sign-in methods. In production only `google`. |
| `GET /api/auth/csrf` | A CSRF token for the sign-in and sign-out forms. |
| `POST /api/auth/signin/google` | Starts Google sign-in (form post with the CSRF token). |
| `GET /api/auth/callback/google` | Where Google returns after sign-in. Not for direct use. |
| `POST /api/auth/signout` | Signs out (form post with the CSRF token). |
| `GET /auth/error` | Redirects a failed or cancelled sign-in back to the page it started from, adding `?signin=failed`. Only same-site paths are allowed, so it can't be used to redirect to another site. |

Example, signed out:

```bash
curl https://laughter-master.vercel.app/api/auth/session
# null
```

## Actions that aren't HTTP endpoints

Posting, deleting, reporting, renaming and admin moderation run as **Next.js Server Actions**: functions the site's own forms call directly. They have no stable URL or request format, so don't call them from other code. Like the endpoints above, each one reads the member from the session and re-checks permissions on the server.

| Action | Who | Where in the app | Rules |
|---|---|---|---|
| Post a joke | Members | `/post` | 10–500 characters; 10 posts per rolling 24 hours (deleted jokes still count). New jokes are checked by Claude: approved with a category, rejected with a reason, or rejected as a duplicate of an existing joke. If moderation is unavailable, the joke waits as `pending`. |
| Delete a joke | The author; admins for any joke | Joke page | Soft delete: it disappears everywhere. |
| Report a joke | Members (not on their own jokes) | Joke page | One report per member per joke, 20 reports per member per day. 5 reports hide a joke until an admin reviews it. Reasons: Offensive, Spam, Plagiarized, Other. |
| Change display name | Members | `/me` | Checked by Claude like a joke; if moderation is unavailable, the old name stays. |
| Review queue: restore, remove, ban | Admins only | `/admin` | Admins are configured on the server. Admins can't be banned. |

## Limits and rules

| Limit | Value | Enforced |
|---|---|---|
| Joke length | 10–500 characters | Yes |
| Posts | 10 per member per rolling 24 hours | Yes |
| Reports | 20 per member per day; 5 hide a joke | Yes |
| Votes | 300 per member per hour (SPEC) | **Not yet**: planned |
| Batch size | 20 jokes per list request | Yes |
| ID length | 200 characters | Yes |

## Changelog

- **2026-11-25:** First version of this document. Covers `GET /api/jokes`, `GET /api/users/{userId}/jokes`, `POST /api/jokes/{jokeId}/vote`, the share card image, and the Auth.js endpoints.

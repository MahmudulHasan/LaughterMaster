// Joke data access for M3 (SPEC US-4, US-5, US-6, US-7, US-18).
// Every function takes the `Db` so tests can pass an in-memory database;
// app code passes `await getReadyDb()`.

import {
  and,
  asc,
  count,
  eq,
  gt,
  inArray,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";

import type { PublicUser } from "../auth/types";
import type { Db } from "../db/client";
import { jokes, users } from "../db/schema";
import { decodeCursor, encodeCursor } from "./cursor";
import {
  JOKE_MAX_LENGTH,
  JOKE_MIN_LENGTH,
  PAGE_SIZE,
  POSTS_PER_DAY,
  jokeLength,
  type CreateJokeResult,
  type JokePage,
  type JokeStatus,
  type JokeView,
  type ProfileView,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PAGE_SIZE = 100;

/**
 * Text used for duplicate checks in M5: Unicode-normalized, lowercase,
 * punctuation removed, whitespace collapsed. Works for any script.
 */
export function normalizeJokeText(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase("und")
    .replace(/\p{P}/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

// Only public user columns, so email can never leak into a JokeView.
const viewColumns = {
  id: jokes.id,
  text: jokes.text,
  status: jokes.status,
  createdAt: jokes.createdAt,
  isBot: jokes.isBot,
  category: jokes.category,
  // Exact Postgres timestamp (microseconds) for cursors; see cursor.ts.
  cursorTs: sql<string>`to_char(${jokes.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  authorId: users.id,
  authorName: users.displayName,
  authorAvatar: users.avatarUrl,
};

export type ViewRow = {
  id: string;
  text: string;
  status: JokeStatus;
  createdAt: Date;
  isBot: boolean;
  category: string | null;
  cursorTs: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
};

export function toView(row: ViewRow): JokeView {
  const author: PublicUser = {
    id: row.authorId,
    displayName: row.authorName,
    avatarUrl: row.authorAvatar,
  };
  return {
    id: row.id,
    text: row.text,
    status: row.status,
    author,
    createdAt: row.createdAt.toISOString(),
    isBot: row.isBot,
    category: row.category,
  };
}

/** Jokes joined to their authors (public columns only). Callers filter banned authors. */
export function selectViews(db: Db) {
  return db
    .select(viewColumns)
    .from(jokes)
    .innerJoin(users, eq(jokes.authorId, users.id));
}

/**
 * Rows counted by the post limit (D8): every joke the member created in the
 * last 24h, whatever its status. Deleted jokes count too, so deleting and
 * reposting can't get around the limit (and each post costs a moderation
 * call in M5).
 */
function recentPostsWhere(userId: string, now: Date): SQL | undefined {
  return and(
    eq(jokes.authorId, userId),
    gt(jokes.createdAt, new Date(now.getTime() - DAY_MS)),
  );
}

/** How many posts count toward the member's limit right now (D8). */
export async function countRecentPosts(
  db: Db,
  userId: string,
  now: Date = new Date(),
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(jokes)
    .where(recentPostsWhere(userId, now));
  return row?.n ?? 0;
}

/**
 * Post a joke (US-4). Trims the text, checks 10–500 graphemes (D7) and the
 * 10 posts per rolling 24h limit (D8). Every joke created in the window
 * counts, deleted ones included. M3 auto-approves; M5 will create jokes as "pending" for moderation.
 */
export async function createJoke(
  db: Db,
  input: { authorId: string; text: string; now?: Date },
): Promise<CreateJokeResult> {
  const text = input.text.trim();
  const length = jokeLength(text);
  if (length < JOKE_MIN_LENGTH) return { ok: false, error: "too_short" };
  if (length > JOKE_MAX_LENGTH) return { ok: false, error: "too_long" };

  // A valid session can outlive its member row (local DB reset, deleted
  // account), and banned members may not post. Treat both as signed out
  // instead of letting the foreign key fail and crash the page.
  const [author] = await db
    .select({ isBanned: users.isBanned })
    .from(users)
    .where(eq(users.id, input.authorId))
    .limit(1);
  if (!author || author.isBanned) return { ok: false, error: "not_signed_in" };

  const now = input.now ?? new Date();
  // Not atomic with the insert. PGlite runs one query at a time, and a rare
  // extra post from a race is acceptable; revisit with hosted Postgres (M9).
  const recent = await db
    .select({ createdAt: jokes.createdAt })
    .from(jokes)
    .where(recentPostsWhere(input.authorId, now))
    .orderBy(asc(jokes.createdAt));
  if (recent.length >= POSTS_PER_DAY) {
    // The member can post again once enough of the counted jokes age out;
    // deleting one doesn't free a slot, so only createdAt matters.
    const freesUp = recent[recent.length - POSTS_PER_DAY]!.createdAt;
    return {
      ok: false,
      error: "rate_limited",
      retryAt: new Date(freesUp.getTime() + DAY_MS).toISOString(),
    };
  }

  const id = crypto.randomUUID();
  await db.insert(jokes).values({
    id,
    authorId: input.authorId,
    text,
    normalizedText: normalizeJokeText(text),
    status: "approved", // M5: "pending" until Claude moderates it.
    createdAt: now,
    updatedAt: now,
  });
  const [row] = await selectViews(db).where(eq(jokes.id, id)).limit(1);
  if (!row) throw new Error("Inserted joke was not found");
  return { ok: true, joke: toView(row) };
}

/**
 * A joke for its page (US-6): approved jokes for anyone, plus the author's
 * own pending jokes. Null for everything else, including banned authors.
 */
export async function getJokeForViewer(
  db: Db,
  id: string,
  viewerId: string | null,
): Promise<JokeView | null> {
  const [row] = await selectViews(db)
    .where(and(eq(jokes.id, id), eq(users.isBanned, false)))
    .limit(1);
  if (!row) return null;
  if (row.status === "approved") return toView(row);
  if (
    row.status === "pending" &&
    viewerId !== null &&
    viewerId === row.authorId
  )
    return toView(row);
  return null;
}

/** Soft-delete the author's own joke (US-5). False if not theirs or gone. */
export async function deleteJoke(
  db: Db,
  input: { jokeId: string; userId: string },
): Promise<boolean> {
  const deleted = await db
    .update(jokes)
    .set({ status: "deleted", updatedAt: sql`now()` })
    .where(
      and(
        eq(jokes.id, input.jokeId),
        eq(jokes.authorId, input.userId),
        ne(jokes.status, "deleted"),
      ),
    )
    .returning({ id: jokes.id });
  return deleted.length > 0;
}

function pageSize(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) return PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(limit)));
}

/**
 * One keyset page, newest first with ties broken by id. A missing or empty
 * cursor starts at the top. A malformed cursor returns an empty last page
 * (never the first page, which would duplicate jokes in the client's list).
 */
async function listPage(
  db: Db,
  where: SQL | undefined,
  cursor: string | null | undefined,
  limit: number | undefined,
): Promise<JokePage> {
  const size = pageSize(limit);
  let after: SQL | undefined;
  if (cursor) {
    const key = decodeCursor(cursor);
    if (!key) return { jokes: [], nextCursor: null };
    after = sql`(${jokes.createdAt}, ${jokes.id}) < (${key.createdAt}::timestamptz, ${key.id})`;
  }
  const rows = await selectViews(db)
    .where(and(where, eq(users.isBanned, false), after))
    .orderBy(sql`${jokes.createdAt} desc`, sql`${jokes.id} desc`)
    .limit(size + 1);
  const page = rows.slice(0, size);
  const last = page[page.length - 1];
  return {
    jokes: page.map(toView),
    nextCursor:
      rows.length > size && last
        ? encodeCursor({ createdAt: last.cursorTs, id: last.id })
        : null,
  };
}

/** All approved jokes (US-7). */
export function listJokes(
  db: Db,
  input: { cursor?: string | null; limit?: number } = {},
): Promise<JokePage> {
  return listPage(db, eq(jokes.status, "approved"), input.cursor, input.limit);
}

/**
 * A member's jokes for their profile (US-18): approved, plus their own
 * pending jokes when the viewer is that member. Empty for banned/unknown.
 */
export function listUserJokes(
  db: Db,
  input: {
    userId: string;
    viewerId?: string | null;
    cursor?: string | null;
    limit?: number;
  },
): Promise<JokePage> {
  const statuses: JokeStatus[] =
    input.viewerId === input.userId ? ["approved", "pending"] : ["approved"];
  return listPage(
    db,
    and(eq(jokes.authorId, input.userId), inArray(jokes.status, statuses)),
    input.cursor,
    input.limit,
  );
}

/** Profile header (US-18, D13). Null for unknown or banned members. */
export async function getProfile(
  db: Db,
  userId: string,
): Promise<ProfileView | null> {
  const [user] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
      isBanned: users.isBanned,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.isBanned) return null;
  const [row] = await db
    .select({ n: count() })
    .from(jokes)
    .where(and(eq(jokes.authorId, userId), eq(jokes.status, "approved")));
  return {
    user: {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    },
    joinedAt: user.createdAt.toISOString(),
    approvedJokeCount: row?.n ?? 0,
  };
}

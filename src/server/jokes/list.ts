import { and, desc, eq, sql, type SQL } from "drizzle-orm";

import type { Db } from "../db/client";
import { jokes, users } from "../db/schema";

import type { PublicJoke } from "./read";

/** Jokes per batch on /jokes and profiles (US-7, US-18). */
export const LIST_PAGE_SIZE = 20;

export type JokePage = { jokes: PublicJoke[]; nextCursor: string | null };

/**
 * One page of public jokes (approved, author not banned), newest first.
 *
 * The cursor is the id of the last joke on the previous page. The next page
 * holds jokes strictly older in (created_at, id) order, compared against
 * that joke's own stored row, so timestamps never round-trip through
 * JavaScript (Postgres keeps microseconds, Date keeps milliseconds). New
 * jokes only appear above the cursor, so paging never repeats or skips one.
 * Deleted jokes stay as rows (soft delete), so an old cursor keeps working.
 *
 * Returns null when the cursor doesn't name a joke.
 */
export async function listPublicJokes(
  db: Db,
  options: { cursor?: string; authorId?: string; limit?: number },
): Promise<JokePage | null> {
  const limit = options.limit ?? LIST_PAGE_SIZE;
  const conditions: SQL[] = [
    eq(jokes.status, "approved"),
    eq(users.isBanned, false),
  ];
  if (options.authorId) conditions.push(eq(jokes.authorId, options.authorId));

  if (options.cursor) {
    const [anchor] = await db
      .select({ id: jokes.id })
      .from(jokes)
      .where(eq(jokes.id, options.cursor))
      .limit(1);
    if (!anchor) return null;
    conditions.push(
      sql`(${jokes.createdAt}, ${jokes.id}) < (select c.created_at, c.id from ${jokes} c where c.id = ${options.cursor})`,
    );
  }

  const rows = await db
    .select({
      id: jokes.id,
      text: jokes.text,
      category: jokes.category,
      isBot: jokes.isBot,
      createdAt: jokes.createdAt,
      author: {
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(jokes)
    .innerJoin(users, eq(users.id, jokes.authorId))
    .where(and(...conditions))
    .orderBy(desc(jokes.createdAt), desc(jokes.id))
    // One extra row tells us whether another page exists.
    .limit(limit + 1);

  const page = rows.slice(0, limit);
  const nextCursor =
    rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
  return { jokes: page, nextCursor };
}

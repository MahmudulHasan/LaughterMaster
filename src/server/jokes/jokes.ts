import { and, desc, eq, gt, sql } from "drizzle-orm";

import type { Db } from "../db/client";
import { jokes, type JokeStatus } from "../db/schema";

import { POSTS_PER_DAY, normalizeJokeText, validateJokeText } from "./text";

export { POSTS_PER_DAY };
const WINDOW_MS = 24 * 60 * 60 * 1000;

export type PostQuota = {
  remaining: number;
  /** When the next post is possible; set only when `remaining` is 0. */
  retryAt: Date | null;
};

export type CreateJokeResult =
  | { ok: true; joke: { id: string; status: JokeStatus }; remaining: number }
  | { ok: false; reason: "invalid"; message: string }
  | { ok: false; reason: "rate_limited"; retryAt: Date };

/**
 * How many posts the member has left in the rolling 24h window. Every joke
 * counts, whatever its status, so deleting one doesn't refund it.
 */
export async function getPostQuota(
  db: Pick<Db, "select">,
  authorId: string,
  now: Date = new Date(),
): Promise<PostQuota> {
  const since = new Date(now.getTime() - WINDOW_MS);
  const recent = await db
    .select({ createdAt: jokes.createdAt })
    .from(jokes)
    .where(and(eq(jokes.authorId, authorId), gt(jokes.createdAt, since)))
    .orderBy(desc(jokes.createdAt))
    .limit(POSTS_PER_DAY);
  const remaining = Math.max(0, POSTS_PER_DAY - recent.length);
  // At the limit, posting reopens when the oldest of the last 10 leaves the window.
  const oldest = recent[POSTS_PER_DAY - 1];
  const retryAt =
    remaining === 0 && oldest
      ? new Date(oldest.createdAt.getTime() + WINDOW_MS)
      : null;
  return { remaining, retryAt };
}

/**
 * Validate and save a member's joke (US-4). Until moderation lands in M5,
 * jokes are approved straight away; nothing is public before M9.
 */
export async function createJoke(
  db: Db,
  input: { authorId: string; text: unknown; now?: Date },
): Promise<CreateJokeResult> {
  const validated = validateJokeText(input.text);
  if (!validated.ok) {
    return { ok: false, reason: "invalid", message: validated.message };
  }
  const now = input.now ?? new Date();

  return db.transaction(async (tx) => {
    // Serialize posts per author so two quick submits can't both pass the
    // limit check. The lock is released when the transaction ends.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${input.authorId}))`,
    );
    const quota = await getPostQuota(tx, input.authorId, now);
    if (quota.remaining === 0 && quota.retryAt) {
      return { ok: false, reason: "rate_limited", retryAt: quota.retryAt };
    }
    const [row] = await tx
      .insert(jokes)
      .values({
        id: crypto.randomUUID(),
        authorId: input.authorId,
        text: validated.text,
        normalizedText: normalizeJokeText(validated.text),
        status: "approved",
        createdAt: now,
      })
      .returning({ id: jokes.id, status: jokes.status });
    if (!row) throw new Error("Joke insert returned no row");
    return { ok: true, joke: row, remaining: quota.remaining - 1 };
  });
}

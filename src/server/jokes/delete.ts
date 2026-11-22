import { and, eq, inArray } from "drizzle-orm";

import type { Db } from "../db/client";
import { jokes, type JokeStatus } from "../db/schema";

/**
 * Statuses an author may delete from. `removed` is an admin decision and
 * stays as it is; `deleted` is already gone.
 */
const DELETABLE: JokeStatus[] = ["pending", "approved", "rejected", "hidden"];

/**
 * Soft-delete the author's own joke (US-5). The row stays, so the daily post
 * limit still counts it and votes can be excluded by status. Another
 * member's joke answers `not_found`, the same as an unknown id, so the
 * response reveals nothing about jokes the caller doesn't own.
 */
export async function deleteJoke(
  db: Db,
  input: { jokeId: string; userId: string },
): Promise<"deleted" | "not_found"> {
  const rows = await db
    .update(jokes)
    .set({ status: "deleted" })
    .where(
      and(
        eq(jokes.id, input.jokeId),
        eq(jokes.authorId, input.userId),
        inArray(jokes.status, DELETABLE),
      ),
    )
    .returning({ id: jokes.id });
  return rows.length > 0 ? "deleted" : "not_found";
}

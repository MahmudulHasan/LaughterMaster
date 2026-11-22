import { and, eq } from "drizzle-orm";

import type { PublicUser } from "../auth/types";
import type { Db } from "../db/client";
import { jokes, users } from "../db/schema";

/** What a page may show about a joke. No email, no vote counts. */
export type PublicJoke = {
  id: string;
  text: string;
  category: string | null;
  isBot: boolean;
  createdAt: Date;
  author: PublicUser;
};

/**
 * A joke anyone may see: approved, by a member who isn't banned. Everything
 * else (unknown, pending, rejected, hidden, removed, deleted) returns null,
 * which the joke page turns into a 404 (US-6).
 */
export async function getPublicJoke(
  db: Db,
  id: string,
): Promise<PublicJoke | null> {
  const [row] = await db
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
    .where(
      and(
        eq(jokes.id, id),
        eq(jokes.status, "approved"),
        eq(users.isBanned, false),
      ),
    )
    .limit(1);
  return row ?? null;
}

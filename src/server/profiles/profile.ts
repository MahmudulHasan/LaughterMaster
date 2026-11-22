import { and, count, desc, eq } from "drizzle-orm";

import type { Db } from "../db/client";
import { jokes, users } from "../db/schema";
import type { PublicJoke } from "../jokes/read";

/** What a profile page shows about a member (US-18). No email. */
export type PublicProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  joinedAt: Date;
  /** Approved jokes only. */
  jokeCount: number;
};

/** The member's public profile, or null if unknown or banned. */
export async function getPublicProfile(
  db: Db,
  id: string,
): Promise<PublicProfile | null> {
  const [user] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      joinedAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.id, id), eq(users.isBanned, false)))
    .limit(1);
  if (!user) return null;

  const [row] = await db
    .select({ n: count() })
    .from(jokes)
    .where(and(eq(jokes.authorId, id), eq(jokes.status, "approved")));
  return { ...user, jokeCount: row?.n ?? 0 };
}

/** Most pending jokes an owner can have at once is small; cap it anyway. */
const PENDING_LIMIT = 20;

/**
 * The member's own jokes still under review, newest first. Only for the
 * owner's view of their profile; nobody else may see pending jokes.
 */
export async function listPendingJokes(
  db: Db,
  authorId: string,
): Promise<PublicJoke[]> {
  return db
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
    .where(and(eq(jokes.authorId, authorId), eq(jokes.status, "pending")))
    .orderBy(desc(jokes.createdAt), desc(jokes.id))
    .limit(PENDING_LIMIT);
}

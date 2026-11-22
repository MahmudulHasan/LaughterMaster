import { eq, sql } from "drizzle-orm";

import type { ProviderProfile, PublicUser } from "./auth/types";
import type { Db } from "./db/client";
import { users } from "./db/schema";

const FALLBACK_DISPLAY_NAME = "Member";

// Selecting only public columns keeps email out of every returned object.
const publicColumns = {
  id: users.id,
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
};

/**
 * Create the member on first sign-in, or refresh their name, photo and email
 * on later sign-ins. The id and created_at never change after creation.
 */
export async function upsertUserFromProvider(
  db: Db,
  profile: ProviderProfile,
  options: { id?: string } = {},
): Promise<PublicUser> {
  const displayName = profile.name.trim() || FALLBACK_DISPLAY_NAME;
  const [row] = await db
    .insert(users)
    .values({
      id: options.id ?? crypto.randomUUID(),
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      displayName,
      avatarUrl: profile.image,
      email: profile.email,
    })
    .onConflictDoUpdate({
      target: [users.provider, users.providerAccountId],
      set: {
        displayName,
        avatarUrl: profile.image,
        email: profile.email,
        updatedAt: sql`now()`,
      },
    })
    .returning(publicColumns);
  if (!row) throw new Error("User upsert returned no row");
  return row;
}

/** The public view of a member, or null if the id is unknown. */
export async function getPublicUser(
  db: Db,
  id: string,
): Promise<PublicUser | null> {
  const [row] = await db
    .select(publicColumns)
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

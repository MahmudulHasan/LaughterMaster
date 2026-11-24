import { and, eq, sql } from "drizzle-orm";

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
 * on later sign-ins (the name only until they choose their own, US-3). The
 * id and created_at never change after creation.
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
        // A name the member chose (US-3) survives later sign-ins.
        displayName: sql`case when ${users.nameCustomized} then ${users.displayName} else ${displayName} end`,
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

/** SPEC US-3: 2–30 characters of letters, numbers, spaces, `_` or `-`. */
export const DISPLAY_NAME_MIN = 2;
export const DISPLAY_NAME_MAX = 30;
const DISPLAY_NAME_PATTERN = /^[\p{L}\p{M}\p{N} _-]+$/u;

export type DisplayNameError = "too_short" | "too_long" | "invalid_characters";

/** Trim, collapse inner spaces and check the rules (any script allowed). */
export function validateDisplayName(
  raw: string,
): { ok: true; name: string } | { ok: false; error: DisplayNameError } {
  const name = raw.trim().replace(/\s+/gu, " ");
  const length = Array.from(name).length;
  if (length < DISPLAY_NAME_MIN) return { ok: false, error: "too_short" };
  if (length > DISPLAY_NAME_MAX) return { ok: false, error: "too_long" };
  if (!DISPLAY_NAME_PATTERN.test(name)) {
    return { ok: false, error: "invalid_characters" };
  }
  return { ok: true, name };
}

/**
 * Save a new display name (US-3) and mark it as chosen, so sign-in won't
 * replace it. Callers validate and moderate it first. Null for unknown or
 * banned members.
 */
export async function setDisplayName(
  db: Db,
  userId: string,
  name: string,
): Promise<PublicUser | null> {
  const [row] = await db
    .update(users)
    .set({ displayName: name, nameCustomized: true, updatedAt: sql`now()` })
    .where(and(eq(users.id, userId), eq(users.isBanned, false)))
    .returning(publicColumns);
  return row ?? null;
}

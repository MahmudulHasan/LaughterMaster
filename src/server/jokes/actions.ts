"use server";

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { isAdmin } from "@/server/auth/admin";
import { getReadyDb } from "@/server/db/ready";
import { getModerator } from "@/server/moderation/shared";
import {
  moderatePendingJoke,
  publishWithoutModeration,
} from "@/server/moderation/pipeline";
import {
  countRecentPosts,
  createJoke,
  deleteJoke,
  removeJokeAsAdmin,
} from "@/server/jokes/queries";
import {
  JOKE_MAX_LENGTH,
  JOKE_MIN_LENGTH,
  POSTS_PER_DAY,
  jokeLength,
  type CreateJokeError,
} from "@/server/jokes/types";

/**
 * State for `useActionState(createJokeAction, null)`. Success never returns:
 * the action redirects to the new joke's page.
 */
export type CreateJokeFormState = {
  error: CreateJokeError;
  /** For "rate_limited": ISO time when the member can post again. */
  retryAt?: string;
  /** For "duplicate": the existing joke it repeats. */
  duplicateOf?: string;
  /** For "rejected": the moderator's short reason. */
  reason?: string;
} | null;

// Cap the raw input well above 500 graphemes (an emoji can be ~10 code units)
// so a huge payload is rejected before we segment it.
const createJokeSchema = z.object({
  text: z.string().max(JOKE_MAX_LENGTH * 20),
});

const deleteJokeSchema = z.object({
  jokeId: z.string().min(1).max(200),
});

async function currentUserId(): Promise<string | null> {
  await connection();
  const session = await auth();
  return session?.user?.id ?? null;
}

/** Posts a joke (US-4). On success it redirects to `/joke/<id>`. */
export async function createJokeAction(
  _prev: CreateJokeFormState,
  formData: FormData,
): Promise<CreateJokeFormState> {
  const userId = await currentUserId();
  if (!userId) return { error: "not_signed_in" };

  const raw = formData.get("text");
  const parsed = createJokeSchema.safeParse({ text: raw ?? "" });
  if (!parsed.success) {
    // A file upload or an absurdly long payload; only a bypassed form sends one.
    return { error: typeof raw === "string" ? "too_long" : "too_short" };
  }
  const length = jokeLength(parsed.data.text);
  if (length < JOKE_MIN_LENGTH) return { error: "too_short" };
  if (length > JOKE_MAX_LENGTH) return { error: "too_long" };

  const db = await getReadyDb();
  const result = await createJoke(db, {
    authorId: userId,
    text: parsed.data.text,
  });
  if (!result.ok) {
    const state: NonNullable<CreateJokeFormState> = { error: result.error };
    if (result.retryAt) state.retryAt = result.retryAt;
    if (result.duplicateOf) state.duplicateOf = result.duplicateOf;
    return state;
  }

  // Admins are trusted: their jokes publish at once, unchecked (SPEC D19).
  // Everyone else's are moderated before anyone else can see them (US-11);
  // if Claude is unavailable the joke stays pending and its page says it's
  // under review. Admin rights come from the server config only.
  const moderation = isAdmin(userId)
    ? await publishWithoutModeration(db, result.joke.id)
    : await moderatePendingJoke(db, result.joke.id, getModerator());
  if (moderation.status === "rejected") {
    return moderation.duplicateOf
      ? { error: "duplicate", duplicateOf: moderation.duplicateOf }
      : { error: "rejected", reason: moderation.reason };
  }
  // redirect() throws, so it must stay outside any try/catch.
  redirect(`/joke/${encodeURIComponent(result.joke.id)}`);
}

/**
 * Deletes the signed-in member's own joke (US-5), then goes to their profile.
 * An admin removing someone else's joke goes to /jokes. Anyone else (or a
 * repeat delete) is sent back to the joke page, which shows the joke or 404.
 */
export async function deleteJokeAction(formData: FormData): Promise<void> {
  const parsed = deleteJokeSchema.safeParse({ jokeId: formData.get("jokeId") });
  if (!parsed.success) redirect("/");
  const { jokeId } = parsed.data;

  const userId = await currentUserId();
  if (!userId) redirect(`/joke/${encodeURIComponent(jokeId)}`);

  const db = await getReadyDb();
  // The author deletes their own joke (US-5); otherwise an admin may remove
  // anyone's joke (US-16). Admin status comes from the server config only.
  if (await deleteJoke(db, { jokeId, userId })) {
    redirect(`/u/${encodeURIComponent(userId)}`);
  }
  if (isAdmin(userId) && (await removeJokeAsAdmin(db, { jokeId }))) {
    redirect("/jokes");
  }
  redirect(`/joke/${encodeURIComponent(jokeId)}`);
}

/**
 * How many posts the signed-in member has left in the rolling 24h window
 * (D8), or null when logged out. Every export of a "use server" module is a
 * callable endpoint, so this reads the session instead of taking a user id
 * (no peeking at other members' counts). The /post page calls it on the server.
 */
export async function getPostsLeftToday(): Promise<number | null> {
  const userId = await currentUserId();
  if (!userId) return null;
  const db = await getReadyDb();
  const used = await countRecentPosts(db, userId);
  return Math.max(0, POSTS_PER_DAY - used);
}

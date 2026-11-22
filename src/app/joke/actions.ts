"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { getAppDb } from "@/server/db/app-db";
import { deleteJoke } from "@/server/jokes/delete";

export type DeleteJokeResult = { ok: true } | { ok: false; message: string };

const jokeIdSchema = z.string().min(1).max(100);

/** Delete the signed-in member's own joke (US-5). */
export async function deleteJokeAction(
  jokeId: string,
): Promise<DeleteJokeResult> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, message: "Sign in to delete your jokes." };

  const parsed = jokeIdSchema.safeParse(jokeId);
  if (!parsed.success) {
    return { ok: false, message: "That isn't a valid joke." };
  }

  const result = await deleteJoke(await getAppDb(), {
    jokeId: parsed.data,
    userId,
  });
  if (result === "not_found") {
    return {
      ok: false,
      message: "This joke can't be deleted. It may already be gone.",
    };
  }
  // Drop any cached copy of the joke page; lists added later read fresh data.
  revalidatePath(`/joke/${parsed.data}`);
  return { ok: true };
}

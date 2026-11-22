"use server";

import { auth } from "@/auth";
import { getAppDb } from "@/server/db/app-db";
import { createJoke } from "@/server/jokes/jokes";

export type PostJokeState =
  | { status: "idle" }
  | { status: "error"; message: string }
  /** `retryAt` is an ISO timestamp; the browser formats it in local time. */
  | { status: "rate_limited"; retryAt: string }
  | { status: "posted"; jokeId: string; remaining: number };

// A "use server" module may export only async functions (types are erased),
// so this constant stays private.
const SIGN_IN_REQUIRED_MESSAGE = "Sign in to post a joke.";

/** Form action for /post (US-4). The author always comes from the session. */
export async function postJokeAction(
  _previous: PostJokeState,
  formData: FormData,
): Promise<PostJokeState> {
  const session = await auth();
  const authorId = session?.user?.id;
  if (!authorId) return { status: "error", message: SIGN_IN_REQUIRED_MESSAGE };

  const db = await getAppDb();
  const result = await createJoke(db, {
    authorId,
    text: formData.get("text"),
  });
  if (result.ok) {
    return {
      status: "posted",
      jokeId: result.joke.id,
      remaining: result.remaining,
    };
  }
  if (result.reason === "rate_limited") {
    return { status: "rate_limited", retryAt: result.retryAt.toISOString() };
  }
  return { status: "error", message: result.message };
}

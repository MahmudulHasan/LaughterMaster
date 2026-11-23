import { connection } from "next/server";

import { auth } from "@/auth";
import { getSignInOptions } from "@/server/auth/providers";
import { getReadyDb } from "@/server/db/ready";
import { listJokes } from "@/server/jokes/queries";
import { withMyVotes } from "@/server/jokes/votes";

import { LazyJokeList } from "./LazyJokeList";
import { PostJokeButton } from "./PostJokeButton";

/** First batch of approved jokes, rendered on the server (US-7). */
export async function AllJokesList() {
  await connection();
  const db = await getReadyDb();
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const listed = await listJokes(db);
  const page = {
    ...listed,
    jokes: await withMyVotes(db, viewerId, listed.jokes),
  };
  // Resolved here rather than nested as an async child, so the session is
  // read only when the list is empty.
  const postButton =
    page.jokes.length === 0 && page.nextCursor === null
      ? await PostJokeButton({})
      : null;
  return (
    <LazyJokeList
      initialPage={page}
      endpoint="/api/jokes"
      storageKey="/jokes"
      votes={{ viewerId, signInOptions: getSignInOptions() }}
      emptyState={
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-[#E3E5EA] bg-white p-6">
          <p className="text-lg">No jokes yet. Be the first!</p>
          {postButton}
        </div>
      }
    />
  );
}

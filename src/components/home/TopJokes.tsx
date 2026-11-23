import { connection } from "next/server";

import { auth } from "@/auth";
import { JokeCard } from "@/components/jokes/JokeCard";
import { PostJokeButton } from "@/components/jokes/PostJokeButton";
import { VoteButtons, type Voter } from "@/components/votes/VoteButtons";
import { getSignInOptions } from "@/server/auth/providers";
import type { SignInOptions } from "@/server/auth/types";
import { getReadyDb } from "@/server/db/ready";
import type { RankedJoke } from "@/server/jokes/types";
import { getTopJokes, withMyVotes } from "@/server/jokes/votes";

function RankedList({
  jokes,
  viewerId,
  signInOptions,
  highlightTop,
}: {
  jokes: RankedJoke[];
  viewerId: string | null;
  signInOptions: SignInOptions;
  highlightTop: boolean;
}) {
  return (
    <ol className="flex flex-col gap-4">
      {jokes.map((joke) => {
        const voter: Voter = !viewerId
          ? "visitor"
          : joke.author.id === viewerId
            ? "author"
            : "member";
        return (
          <li key={joke.id} className="flex gap-3 sm:gap-4">
            <span
              aria-label={`Rank ${joke.rank}`}
              className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-lg font-bold text-[#15161A] ${
                highlightTop && joke.rank <= 3 ? "bg-[#FFD23F]" : "bg-[#EEF0F4]"
              }`}
            >
              #{joke.rank}
            </span>
            <div className="min-w-0 flex-1">
              <JokeCard
                joke={joke}
                actions={
                  <VoteButtons
                    jokeId={joke.id}
                    myVote={joke.myVote}
                    voter={voter}
                    signInOptions={signInOptions}
                  />
                }
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The home page ranking (US-10): today's top jokes, then "From this week"
 * when today has fewer than 10. Reads the session, so it renders inside
 * <Suspense>. Computed per request (see PLAN M4 note on caching).
 */
export async function TopJokes() {
  await connection();
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const db = await getReadyDb();
  const top = await getTopJokes(db);
  const [today, week] = await Promise.all([
    withMyVotes(db, viewerId, top.today),
    withMyVotes(db, viewerId, top.week),
  ]);
  const signInOptions = getSignInOptions();

  if (today.length === 0 && week.length === 0) {
    // Resolved here rather than nested as an async child (as AllJokesList does).
    const postButton = await PostJokeButton({});
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-[#E3E5EA] bg-white p-6">
        <p className="text-lg">No jokes yet. Be the first!</p>
        {postButton}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {today.length > 0 ? (
        <RankedList
          jokes={today}
          viewerId={viewerId}
          signInOptions={signInOptions}
          highlightTop
        />
      ) : (
        <p className="rounded-2xl border border-[#E3E5EA] bg-white p-6 text-lg">
          No jokes in the last 24 hours yet. Post one and take the #1 spot!
        </p>
      )}
      {week.length > 0 && (
        <section aria-labelledby="from-this-week">
          <div className="mb-4 border-t border-dashed border-black/20 pt-6">
            <h2 id="from-this-week" className="text-2xl font-bold">
              From this week
            </h2>
            <p className="mt-1 text-sm text-black/60">
              Fewer than 10 jokes were posted in the last 24 hours, so we filled
              the rest with this week&apos;s best.
            </p>
          </div>
          <RankedList
            jokes={week}
            viewerId={viewerId}
            signInOptions={signInOptions}
            highlightTop={false}
          />
        </section>
      )}
    </div>
  );
}

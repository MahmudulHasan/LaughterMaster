import Link from "next/link";
import { connection } from "next/server";

import { auth } from "@/auth";
import { primaryButton } from "@/components/buttonStyles";
import { JokeCard } from "@/components/jokes/JokeCard";
import { SignInButton } from "@/components/SignInButton";

import { DisplayNameForm } from "./DisplayNameForm";
import { getSignInOptions } from "@/server/auth/providers";
import { getReadyDb } from "@/server/db/ready";
import type { MyJokeStats } from "@/server/jokes/types";
import { getMyJokeStats } from "@/server/jokes/votes";
import { isModerationAvailable } from "@/server/moderation/moderator";

function StatsRow({ joke }: { joke: MyJokeStats }) {
  const stats: Array<[string, number]> = [
    ["Likes", joke.likes],
    ["Dislikes", joke.dislikes],
    ["Score", joke.score],
  ];
  return (
    <dl className="flex flex-wrap gap-2" aria-label="Your private stats">
      {stats.map(([label, value]) => (
        // Label first in the DOM for screen readers; shown below the number.
        <div
          key={label}
          className="flex min-w-16 flex-col-reverse items-center rounded-xl bg-[#F5F6F8] px-3 py-2"
        >
          <dt className="text-xs text-black/60">{label}</dt>
          <dd className="text-lg font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * "My jokes" (US-9): the signed-in author's jokes with private like,
 * dislike and score counts. Reads the session, so it renders inside
 * <Suspense>. Visitors get a sign-in prompt.
 */
export async function MyJokes() {
  await connection();
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-[#E3E5EA] bg-white p-6">
        <p className="text-lg">Sign in to see how your jokes are doing.</p>
        <SignInButton
          action="signin"
          options={getSignInOptions()}
          className={primaryButton}
        >
          Sign in
        </SignInButton>
      </div>
    );
  }

  const db = await getReadyDb();
  const jokes = await getMyJokeStats(db, userId);
  // Renaming needs Claude to check the new name (US-3, fail closed). Without
  // moderation it could never succeed, so the form is left out.
  const nameForm = isModerationAvailable() ? (
    <DisplayNameForm currentName={session.user.name} />
  ) : null;

  if (jokes.length === 0) {
    return (
      <>
        {nameForm}
        <div className="flex flex-col items-start gap-4 rounded-2xl border border-[#E3E5EA] bg-white p-6">
          <p className="text-lg">You haven&apos;t posted any jokes yet.</p>
          <Link href="/post" className={primaryButton}>
            Post a joke
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      {nameForm}
      <ul className="flex flex-col gap-4">
        {jokes.map((joke) => (
          <li key={joke.id}>
            <JokeCard joke={joke} actions={<StatsRow joke={joke} />} />
          </li>
        ))}
      </ul>
    </>
  );
}

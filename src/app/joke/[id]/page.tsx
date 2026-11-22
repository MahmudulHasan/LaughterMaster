import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/auth";
import { DeleteJokeButton } from "@/components/DeleteJokeButton";
import { JokeView } from "@/components/JokeView";
import { getAppDb } from "@/server/db/app-db";
import { getPublicJoke } from "@/server/jokes/read";

type Props = { params: Promise<{ id: string }> };

/** Request-time lookup; `connection()` keeps it out of prerendering. */
async function loadJoke(params: Props["params"]) {
  await connection();
  return getPublicJoke(await getAppDb(), (await params).id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const joke = await loadJoke(params);
  return {
    title: joke
      ? `Joke by ${joke.author.displayName} · LaughterMaster`
      : "Joke not available · LaughterMaster",
  };
}

/**
 * Streams in behind the static shell. An unavailable joke renders
 * not-found.tsx with a noindex tag; with cacheComponents the status is
 * already 200 by then (see SPEC US-6 note).
 */
export async function JokeBody({ params }: Props) {
  const joke = await loadJoke(params);
  if (!joke) notFound();
  const session = await auth();
  const isAuthor = session?.user?.id === joke.author.id;
  return (
    <JokeView
      joke={joke}
      now={new Date()}
      actions={
        isAuthor ? <DeleteJokeButton jokeId={joke.id} redirectTo="/" /> : null
      }
    />
  );
}

export default function JokePage({ params }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pt-8 pb-16">
      <Link
        href="/"
        className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-xl font-medium text-black/75 hover:text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to Top 10
      </Link>
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            className="h-80 animate-pulse rounded-3xl bg-black/5"
          />
        }
      >
        <JokeBody params={params} />
      </Suspense>
    </main>
  );
}

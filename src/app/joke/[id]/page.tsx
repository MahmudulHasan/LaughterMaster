import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { JokePageContent } from "@/components/joke/JokePageContent";
import { jokeTitle } from "@/components/joke/jokeTitle";
import { getReadyDb } from "@/server/db/ready";
import { getJokeForViewer } from "@/server/jokes/queries";

/**
 * Tab title from the joke's first words. Uses the public view (no session), so
 * an author's own pending joke keeps the generic title. An unavailable joke
 * also gets the generic title; Next adds `noindex` when the body calls
 * notFound() (D16 soft 404).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  // Request-time DB read; without this, cacheComponents tries to prerender it.
  await connection();
  const { id } = await params;
  const joke = await getJokeForViewer(await getReadyDb(), id, null);
  return { title: jokeTitle(joke?.text ?? null) };
}

export default function JokePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            className="mt-14 h-72 animate-pulse rounded-3xl bg-black/5"
          />
        }
      >
        <JokePageContent params={params} />
      </Suspense>
    </main>
  );
}

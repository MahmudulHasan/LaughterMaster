import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { JokePageContent } from "@/components/joke/JokePageContent";
import { jokeTitle } from "@/components/joke/jokeTitle";
import { cardText } from "@/components/share/cardText";
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
  const title = jokeTitle(joke?.text ?? null);
  if (!joke) return { title };
  // Share previews (US-17). The image comes from opengraph-image.tsx, which
  // Next links as og:image; X/Twitter use it via summary_large_image.
  const description = cardText(joke.text, 160);
  const byline = `A joke by ${joke.author.displayName} on LaughterMaster`;
  return {
    title,
    description: byline,
    openGraph: {
      type: "article",
      siteName: "LaughterMaster",
      title: description,
      description: byline,
      url: `/joke/${encodeURIComponent(joke.id)}`,
    },
    twitter: {
      card: "summary_large_image",
      title: description,
      description: byline,
    },
  };
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

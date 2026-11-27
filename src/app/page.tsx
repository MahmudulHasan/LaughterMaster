import Link from "next/link";
import { Suspense } from "react";

import { TopJokes } from "@/components/home/TopJokes";
import { WebJoke } from "@/components/home/WebJoke";
import { JokeListSkeleton } from "@/components/jokes/JokeListSkeleton";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-wrap items-start gap-8 px-4 py-10">
      <div className="min-w-0 flex-[999_1_560px]">
        <h1 className="text-4xl font-bold tracking-tight">Top 10 of the day</h1>
        <p className="mt-2 mb-6 text-sm text-black/60">
          Jokes posted in the last 24 hours, ranked by your votes.
        </p>
        <Suspense fallback={<JokeListSkeleton count={4} />}>
          <TopJokes />
        </Suspense>
        <p className="mt-8 text-center">
          <Link
            href="/jokes"
            className="inline-flex min-h-11 items-center rounded-xl border border-black/15 bg-white px-5 font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
          >
            Browse all jokes
          </Link>
        </p>
      </div>
      <aside className="flex flex-[1_1_260px] flex-col gap-6">
        <section className="rounded-2xl border border-[#E3E5EA] bg-white p-6">
          <h2 className="text-base font-semibold">How the top 10 works</h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-[#3D414B]">
            <li>Only jokes posted in the last 24 hours compete.</li>
            <li>
              Score is likes minus dislikes. Ties go to the joke with more
              votes, then the earlier post.
            </li>
            <li>
              Vote counts stay private, so the ranking can&apos;t be gamed by
              bandwagons.
            </li>
            <li>
              On a quiet day, the list is topped up with this week&apos;s best.
            </li>
          </ul>
        </section>
        {/* Cached on the server; if the source is down the box is left out. */}
        <Suspense fallback={null}>
          <WebJoke />
        </Suspense>
      </aside>
    </main>
  );
}

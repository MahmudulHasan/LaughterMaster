import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { EmptyJokes } from "@/components/EmptyJokes";
import { LazyJokeList } from "@/components/LazyJokeList";
import { toJokeListItem } from "@/lib/joke-list-item";
import { getAppDb } from "@/server/db/app-db";
import { listPublicJokes } from "@/server/jokes/list";

export const metadata: Metadata = { title: "All jokes · LaughterMaster" };

/** The server-rendered first batch, so the page works before any script. */
export async function AllJokesList() {
  await connection();
  const page = await listPublicJokes(await getAppDb(), {});
  return (
    <LazyJokeList
      listKey="all"
      initialPage={{
        jokes: page?.jokes.map(toJokeListItem) ?? [],
        nextCursor: page?.nextCursor ?? null,
      }}
      now={new Date().toISOString()}
      emptyState={<EmptyJokes />}
    />
  );
}

export default function AllJokesPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 pt-8 pb-16">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-4xl font-extrabold tracking-tight">All jokes</h1>
        <p className="text-sm text-black/65">
          Newest first · more load as you scroll
        </p>
      </div>
      <Suspense
        fallback={
          <div aria-hidden="true" className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-2xl bg-black/5"
              />
            ))}
          </div>
        }
      >
        <AllJokesList />
      </Suspense>
    </main>
  );
}

import type { Metadata } from "next";
import { Suspense } from "react";

import { AllJokesList } from "@/components/jokes/AllJokesList";
import { JokeListSkeleton } from "@/components/jokes/JokeListSkeleton";

export const metadata: Metadata = {
  title: "All jokes · LaughterMaster",
};

export default function AllJokesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">All jokes</h1>
      <p className="mt-1 mb-6 text-black/60">Newest first</p>
      <Suspense fallback={<JokeListSkeleton />}>
        <AllJokesList />
      </Suspense>
    </main>
  );
}

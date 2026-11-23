import type { Metadata } from "next";
import { Suspense } from "react";

import { JokeListSkeleton } from "@/components/jokes/JokeListSkeleton";
import { MyJokes } from "@/components/me/MyJokes";

export const metadata: Metadata = {
  title: "My jokes · LaughterMaster",
  // Private stats: never index this page.
  robots: { index: false },
};

export default function MyJokesPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-4xl font-bold tracking-tight">My jokes</h1>
      <p className="mt-2 mb-6 text-sm text-black/60">
        Your likes, dislikes and score. Only you can see these numbers.
      </p>
      <Suspense fallback={<JokeListSkeleton count={3} />}>
        <MyJokes />
      </Suspense>
    </main>
  );
}

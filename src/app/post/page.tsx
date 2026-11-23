import type { Metadata } from "next";
import { Suspense } from "react";

import { PostJokeGate } from "@/components/post/PostJokeGate";

export const metadata: Metadata = { title: "Post a joke · LaughterMaster" };

export default function PostPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Post a joke</h1>
      <p className="mt-2 text-base text-black/70">
        It competes in today&apos;s top 10 for the next 24 hours.
      </p>
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            className="mt-6 h-80 animate-pulse rounded-2xl bg-black/5"
          />
        }
      >
        <PostJokeGate />
      </Suspense>
    </main>
  );
}

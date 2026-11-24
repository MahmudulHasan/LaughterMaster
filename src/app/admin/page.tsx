import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminQueue } from "@/components/admin/AdminQueue";
import { JokeListSkeleton } from "@/components/jokes/JokeListSkeleton";

export const metadata: Metadata = {
  title: "Review queue · LaughterMaster",
  robots: { index: false },
};

export default function AdminPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <h1 className="text-4xl font-bold tracking-tight">Review queue</h1>
      <p className="mt-2 mb-6 text-sm text-black/60">
        Jokes hidden by reports, and jokes still waiting for moderation.
      </p>
      <Suspense fallback={<JokeListSkeleton count={3} />}>
        <AdminQueue />
      </Suspense>
    </main>
  );
}

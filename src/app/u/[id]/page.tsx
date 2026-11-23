import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { JokeListSkeleton } from "@/components/jokes/JokeListSkeleton";
import {
  ProfileContent,
  type ProfileParams,
} from "@/components/jokes/ProfileContent";
import { getReadyDb } from "@/server/db/ready";
import { getProfile } from "@/server/jokes/queries";

/** Tab title from the member's name; unknown or banned members get the generic one. */
export async function generateMetadata({
  params,
}: {
  params: ProfileParams;
}): Promise<Metadata> {
  // Request-time DB read; without this, cacheComponents tries to prerender it.
  await connection();
  const { id } = await params;
  const profile = await getProfile(await getReadyDb(), id);
  const name = profile?.user.displayName ?? "Member profile";
  return { title: `${name} · LaughterMaster` };
}

export default function ProfilePage({ params }: { params: ProfileParams }) {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <Suspense
        fallback={
          <>
            <div className="mb-8 h-28 animate-pulse rounded-2xl border border-[#E3E5EA] bg-white" />
            <JokeListSkeleton />
          </>
        }
      >
        <ProfileContent params={params} />
      </Suspense>
    </main>
  );
}

import { notFound } from "next/navigation";
import { connection } from "next/server";

import Link from "next/link";

import { auth } from "@/auth";
import { secondaryButton } from "@/components/buttonStyles";
import { Avatar } from "@/components/UserMenu";
import { getSignInOptions } from "@/server/auth/providers";
import { getReadyDb } from "@/server/db/ready";
import { getProfile, listUserJokes } from "@/server/jokes/queries";
import { withMyVotes } from "@/server/jokes/votes";

import { LazyJokeList } from "./LazyJokeList";

export type ProfileParams = Promise<{ id: string }>;

const joinedFormat = new Intl.DateTimeFormat("en", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function jokeCount(count: number): string {
  return count === 1 ? "1 joke" : `${count} jokes`;
}

/**
 * Profile header and the member's jokes (US-18, D13). Reads params and the
 * session, so it renders inside <Suspense>. The owner also sees their own
 * pending jokes, marked "Under review" by JokeCard.
 */
export async function ProfileContent({ params }: { params: ProfileParams }) {
  await connection();
  const { id } = await params;
  const db = await getReadyDb();
  const profile = await getProfile(db, id);
  if (!profile) notFound();

  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const isOwner = viewerId === profile.user.id;
  const listed = await listUserJokes(db, { userId: id, viewerId });
  const page = {
    ...listed,
    jokes: await withMyVotes(db, viewerId, listed.jokes),
  };
  const name = profile.user.displayName;

  return (
    <>
      <section className="flex items-center gap-4 rounded-2xl border border-[#E3E5EA] bg-white p-6">
        <Avatar user={{ name, image: profile.user.avatarUrl }} size={72} />
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight break-words">
            {name}
          </h1>
          <p className="mt-1 text-black/60">
            Joined {joinedFormat.format(new Date(profile.joinedAt))} ·{" "}
            {jokeCount(profile.approvedJokeCount)}
          </p>
        </div>
      </section>

      {isOwner && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#EEF0F4] px-4 py-3 text-sm text-[#3A3D46]">
          <p>
            You&apos;re viewing your own profile. Jokes under review are only
            visible to you.
          </p>
          <Link href="/me" className={secondaryButton}>
            My stats
          </Link>
        </div>
      )}

      <h2 className="mt-8 mb-4 text-xl font-semibold">Jokes</h2>
      <LazyJokeList
        initialPage={page}
        endpoint={`/api/users/${encodeURIComponent(id)}/jokes`}
        storageKey={`/u/${id}${isOwner ? "#owner" : ""}`}
        votes={{ viewerId, signInOptions: getSignInOptions() }}
        emptyState={
          <p className="rounded-2xl border border-[#E3E5EA] bg-white p-6 text-lg">
            {name} hasn&apos;t posted any jokes yet.
          </p>
        }
      />
    </>
  );
}

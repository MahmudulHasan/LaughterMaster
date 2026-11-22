import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/auth";
import { Avatar } from "@/components/Avatar";
import { DeleteJokeButton } from "@/components/DeleteJokeButton";
import { JokeCard } from "@/components/JokeCard";
import { LazyJokeList } from "@/components/LazyJokeList";
import { toJokeListItem } from "@/lib/joke-list-item";
import { getAppDb } from "@/server/db/app-db";
import { listPublicJokes } from "@/server/jokes/list";
import { getPublicProfile, listPendingJokes } from "@/server/profiles/profile";

type Props = { params: Promise<{ id: string }> };

async function loadProfile(params: Props["params"]) {
  await connection();
  return getPublicProfile(await getAppDb(), (await params).id);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await loadProfile(params);
  return {
    title: profile
      ? `${profile.displayName} · LaughterMaster`
      : "Profile not available · LaughterMaster",
  };
}

/** "Joined November 2026", in UTC so server and browser agree. */
function joinedLabel(date: Date): string {
  return `Joined ${date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })}`;
}

/**
 * The profile (US-18). Everyone sees the header and the member's approved
 * jokes. The owner also sees their jokes under review and Delete buttons.
 */
export async function ProfileBody({ params }: Props) {
  const profile = await loadProfile(params);
  if (!profile) notFound();

  const db = await getAppDb();
  const session = await auth();
  const isOwner = session?.user?.id === profile.id;
  const [page, pending] = await Promise.all([
    listPublicJokes(db, { authorId: profile.id }),
    isOwner ? listPendingJokes(db, profile.id) : Promise.resolve([]),
  ]);
  const now = new Date();
  const jokesLabel = `${profile.jokeCount} ${profile.jokeCount === 1 ? "joke" : "jokes"}`;

  return (
    <>
      <section className="flex flex-wrap items-center gap-6 rounded-2xl border border-black/10 bg-white p-7">
        <Avatar
          user={{ name: profile.displayName, image: profile.avatarUrl }}
          size={96}
        />
        <div className="flex min-w-60 flex-1 flex-col gap-1.5">
          <h1 className="text-4xl font-extrabold tracking-tight break-words">
            {profile.displayName}
          </h1>
          <p className="text-black/65">
            {joinedLabel(profile.joinedAt)} · {jokesLabel}
          </p>
        </div>
      </section>

      {isOwner && (
        <p className="rounded-xl bg-[#EEF0F4] px-4 py-3 text-sm text-black/75">
          You&apos;re viewing your own profile. Jokes under review and the
          Delete buttons are only visible to you.
        </p>
      )}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-extrabold">Jokes</h2>
        <p className="text-sm text-black/65">
          Newest first · more load as you scroll
        </p>
      </div>

      {pending.length > 0 && (
        <ul aria-label="Jokes under review" className="flex flex-col gap-3">
          {pending.map((joke) => (
            <li key={joke.id}>
              <JokeCard
                joke={toJokeListItem(joke)}
                now={now}
                underReview
                actions={<DeleteJokeButton jokeId={joke.id} />}
              />
            </li>
          ))}
        </ul>
      )}

      <LazyJokeList
        listKey={`u:${profile.id}`}
        author={profile.id}
        canDelete={isOwner}
        initialPage={{
          jokes: page?.jokes.map(toJokeListItem) ?? [],
          nextCursor: page?.nextCursor ?? null,
        }}
        now={now.toISOString()}
        emptyState={
          <p className="rounded-2xl border border-black/10 bg-white px-6 py-10 text-center text-black/70">
            {profile.displayName} hasn&apos;t posted any jokes yet.
          </p>
        }
      />
    </>
  );
}

export default function ProfilePage({ params }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pt-8 pb-16">
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            className="h-40 animate-pulse rounded-2xl bg-black/5"
          />
        }
      >
        <ProfileBody params={params} />
      </Suspense>
    </main>
  );
}

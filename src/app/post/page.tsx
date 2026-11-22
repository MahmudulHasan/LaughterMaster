import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { auth } from "@/auth";
import { primaryButton } from "@/components/buttonStyles";
import { PostJokeForm } from "@/components/PostJokeForm";
import { SignInButton } from "@/components/SignInButton";
import { getSignInOptions } from "@/server/auth/providers";
import { getAppDb } from "@/server/db/app-db";
import { getPostQuota } from "@/server/jokes/jokes";

export const metadata: Metadata = { title: "Post a joke · LaughterMaster" };

/** Reads the session, so it renders per request inside the page's Suspense. */
export async function PostJokeBody() {
  await connection();
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-black/10 bg-white p-7">
        <p>You need an account to post a joke. Reading stays open to all.</p>
        <SignInButton
          action="post"
          options={getSignInOptions()}
          className={primaryButton}
        >
          Sign in to post
        </SignInButton>
      </div>
    );
  }

  const quota = await getPostQuota(await getAppDb(), userId);
  return (
    <PostJokeForm
      remaining={quota.remaining}
      retryAt={quota.retryAt?.toISOString() ?? null}
    />
  );
}

export default function PostPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 pt-10 pb-16">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-4xl font-extrabold tracking-tight">Post a joke</h1>
        <p className="text-black/65">
          It competes in today’s top 10 for the next 24 hours.
        </p>
      </div>
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            className="h-96 animate-pulse rounded-2xl bg-black/5"
          />
        }
      >
        <PostJokeBody />
      </Suspense>
    </main>
  );
}

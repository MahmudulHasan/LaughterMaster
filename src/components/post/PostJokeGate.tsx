import { connection } from "next/server";

import { auth } from "@/auth";
import { primaryButton } from "@/components/buttonStyles";
import { SignInButton } from "@/components/SignInButton";
import { getSignInOptions } from "@/server/auth/providers";
import { getPostsLeftToday } from "@/server/jokes/actions";

import { PostJokeForm } from "./PostJokeForm";

/**
 * Session-aware part of `/post`: the form for members, a sign-in prompt for
 * visitors (reading never needs an account). It reads cookies, so it must
 * render inside <Suspense>.
 */
export async function PostJokeGate() {
  await connection();
  const session = await auth();
  if (!session?.user) {
    return (
      <section
        aria-labelledby="post-signin-heading"
        className="mt-6 rounded-2xl border border-black/10 bg-white p-6 shadow-sm"
      >
        <h2 id="post-signin-heading" className="text-lg font-semibold">
          Sign in to post a joke
        </h2>
        <p className="mt-2 text-black/70">
          Reading jokes is free for everyone. To post your own, sign in with
          your Google account. We only show your name and profile photo.
        </p>
        <div className="mt-5">
          <SignInButton
            action="post"
            options={getSignInOptions()}
            redirectTo="/post"
            className={`${primaryButton} min-h-12 px-6`}
          >
            Sign in to post
          </SignInButton>
        </div>
      </section>
    );
  }
  const postsLeft = await getPostsLeftToday();
  return <PostJokeForm postsLeft={postsLeft} />;
}

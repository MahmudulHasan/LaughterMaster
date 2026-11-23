import Link from "next/link";
import { connection } from "next/server";
import type { ReactNode } from "react";

import { auth } from "@/auth";
import { primaryButton } from "@/components/buttonStyles";
import { SignInButton } from "@/components/SignInButton";
import { getSignInOptions } from "@/server/auth/providers";

/**
 * "Post a joke" call to action for empty states: a link to /post for
 * members, the sign-in dialog for visitors (US-2). Reads the session, so it
 * must render inside <Suspense>.
 */
export async function PostJokeButton({
  children = "Post a joke",
}: {
  children?: ReactNode;
}) {
  await connection();
  const session = await auth();
  if (session?.user) {
    return (
      <Link href="/post" className={primaryButton}>
        {children}
      </Link>
    );
  }
  return (
    <SignInButton
      action="post"
      options={getSignInOptions()}
      className={primaryButton}
    >
      {children}
    </SignInButton>
  );
}

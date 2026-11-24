import Link from "next/link";
import { connection } from "next/server";

import { auth } from "@/auth";
import { isAdmin } from "@/server/auth/admin";
import { getSignInOptions } from "@/server/auth/providers";

import { primaryButton, quietButton, secondaryButton } from "./buttonStyles";
import { SignInButton } from "./SignInButton";
import { SignInNotice } from "./SignInNotice";
import { SiteHeaderShell } from "./SiteHeaderShell";
import { UserMenu } from "./UserMenu";

/**
 * Session-aware header. It reads cookies via `auth()`, so with
 * `cacheComponents` it must render inside <Suspense> (see the root layout).
 * Only id, name and image reach the client; never the email.
 */
export async function SiteHeader() {
  // Auth.js uses crypto.getRandomValues() before it reads cookies, which
  // cacheComponents forbids during prerendering. Opt this subtree into
  // request-time rendering first; the layout's Suspense keeps the rest static.
  await connection();
  const session = await auth();
  const user = session?.user ?? null;

  if (user) {
    return (
      <SiteHeaderShell
        actions={
          <>
            {isAdmin(user.id) && (
              <Link href="/admin" className={quietButton}>
                Admin
              </Link>
            )}
            <Link href="/post" className={primaryButton}>
              Post a joke
            </Link>
            <UserMenu
              user={{ id: user.id, name: user.name, image: user.image }}
            />
          </>
        }
      />
    );
  }

  // Sync and env-based; computed here so env never reaches the client.
  const options = getSignInOptions();
  return (
    <>
      <SiteHeaderShell
        actions={
          <>
            <SignInButton
              action="post"
              options={options}
              className={primaryButton}
            >
              Post a joke
            </SignInButton>
            <SignInButton
              action="signin"
              options={options}
              className={secondaryButton}
            >
              Sign in
            </SignInButton>
          </>
        }
      />
      <SignInNotice />
    </>
  );
}

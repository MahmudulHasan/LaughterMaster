"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { signOutAction } from "@/server/auth/actions";
import type { SessionUser } from "@/server/auth/types";

import { Avatar } from "./Avatar";
import { secondaryButton } from "./buttonStyles";

/**
 * Signed-in header controls: avatar and name linking to your profile, and a
 * Sign out form.
 */
export function UserMenu({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/u/${user.id}`}
        aria-label={`Your profile: ${user.name}`}
        className="flex min-h-11 items-center gap-2 rounded-xl hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
      >
        <Avatar user={user} />
        <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
          {user.name}
        </span>
      </Link>
      <form action={signOutAction}>
        <input type="hidden" name="redirectTo" value={pathname || "/"} />
        <button type="submit" className={secondaryButton}>
          Sign out
        </button>
      </form>
    </div>
  );
}

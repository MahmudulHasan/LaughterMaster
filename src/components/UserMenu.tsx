"use client";

import { usePathname } from "next/navigation";

import { signOutAction } from "@/server/auth/actions";
import type { SessionUser } from "@/server/auth/types";

import { Avatar } from "./Avatar";
import { secondaryButton } from "./buttonStyles";

/** Signed-in header controls: avatar, name, and a Sign out form. */
export function UserMenu({ user }: { user: SessionUser }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-2">
      <Avatar user={user} />
      <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:inline">
        {user.name}
      </span>
      <form action={signOutAction}>
        <input type="hidden" name="redirectTo" value={pathname || "/"} />
        <button type="submit" className={secondaryButton}>
          Sign out
        </button>
      </form>
    </div>
  );
}

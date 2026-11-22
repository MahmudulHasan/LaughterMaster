"use client";

import { usePathname } from "next/navigation";

import { signOutAction } from "@/server/auth/actions";
import type { SessionUser } from "@/server/auth/types";

import { secondaryButton } from "./buttonStyles";

/** Up to two initials from a display name, e.g. "Mina Park" -> "MP". */
export function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "");
  return letters.join("").toUpperCase() || "?";
}

export function Avatar({
  user,
  size = 36,
}: {
  user: Pick<SessionUser, "name" | "image">;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (user.image) {
    return (
      // Plain <img>: avatars come from Google's CDN, and next/image would need
      // remotePatterns config plus an optimizer hop for a 36px picture.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.image}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className="shrink-0 rounded-full object-cover"
        style={style}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#FFD23F] text-sm font-bold text-[#15161A]"
      style={style}
    >
      {initials(user.name)}
    </span>
  );
}

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

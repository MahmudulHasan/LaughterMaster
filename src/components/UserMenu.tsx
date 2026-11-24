"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { signOutAction } from "@/server/auth/actions";
import type { SessionUser } from "@/server/auth/types";

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

const menuItem =
  "flex min-h-11 w-full items-center rounded-lg px-3 text-left font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]";

/**
 * Signed-in account menu: the avatar (plus the name from `lg` up) opens a
 * small list with My jokes, Admin (admins only) and Sign out. A native
 * <details> works before hydration; the effect only adds closing on an
 * outside click, Escape, or navigation.
 */
export function UserMenu({
  user,
  isAdmin = false,
}: {
  user: SessionUser;
  /** Decided on the server; only this boolean reaches the client. */
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const ref = useRef<HTMLDetailsElement>(null);

  // Close after navigating to another page.
  useEffect(() => {
    ref.current?.removeAttribute("open");
  }, [pathname]);

  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    function onPointerDown(event: PointerEvent) {
      if (menu && !menu.contains(event.target as Node)) menu.open = false;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !menu?.open) return;
      menu.open = false;
      menu.querySelector("summary")?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <details ref={ref} className="relative">
      <summary
        aria-label={`Account menu for ${user.name}`}
        className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center gap-2 rounded-xl px-1 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8] sm:px-2 [&::-webkit-details-marker]:hidden"
      >
        <Avatar user={user} />
        <span className="hidden max-w-[10rem] truncate text-sm font-medium lg:inline">
          {user.name}
        </span>
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hidden text-black/60 sm:block"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="absolute top-full right-0 z-40 mt-2 w-56 rounded-xl border border-black/10 bg-white p-1.5 shadow-lg">
        <p className="truncate px-3 py-2 text-sm text-black/60 lg:hidden">
          {user.name}
        </p>
        <Link href="/me" className={menuItem}>
          My jokes
        </Link>
        {isAdmin && (
          <Link href="/admin" className={menuItem}>
            Admin
          </Link>
        )}
        <form action={signOutAction}>
          <input type="hidden" name="redirectTo" value={pathname || "/"} />
          <button type="submit" className={menuItem}>
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

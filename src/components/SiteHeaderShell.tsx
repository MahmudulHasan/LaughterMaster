import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The static part of the header (logo + nav). It reads no request data, so
 * the layout can use it on its own as the Suspense fallback while the
 * session-aware SiteHeader streams in.
 */
export function SiteHeaderShell({ actions }: { actions?: ReactNode }) {
  return (
    // Sticky: the page scrolls underneath while the header stays in place.
    <header className="sticky top-0 z-30 border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link
          href="/"
          className="flex min-h-11 items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
        >
          <span
            aria-hidden="true"
            className="inline-flex size-9 items-center justify-center rounded-xl bg-[#FFD23F]"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#15161A"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <path d="M9 9h.01M15 9h.01" />
            </svg>
          </span>
          <span className="text-xl font-bold tracking-tight">
            LaughterMaster
          </span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-xl px-3 font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
          >
            Top 10
          </Link>
          <Link
            href="/jokes"
            className="inline-flex min-h-11 items-center rounded-xl px-3 font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
          >
            All jokes
          </Link>
        </nav>
        <div className="ml-auto flex min-h-11 items-center gap-2">
          {actions}
        </div>
      </div>
    </header>
  );
}

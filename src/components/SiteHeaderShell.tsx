import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The static part of the header (logo + nav). It reads no request data, so
 * the layout can use it on its own as the Suspense fallback while the
 * session-aware SiteHeader streams in.
 *
 * Phones get two rows (logo + account, then nav + Post a joke) so the sticky
 * header stays short; from `sm` up everything sits on one row:
 * logo, nav, Post a joke, account.
 */
export function SiteHeaderShell({
  post,
  account,
}: {
  /** The Post a joke button. */
  post?: ReactNode;
  /** Sign in, or the signed-in account menu. */
  account?: ReactNode;
}) {
  return (
    // Sticky: the page scrolls underneath while the header stays in place.
    // The markup follows the desktop order (and the Tab order); `order-*`
    // only rearranges it visually on phones.
    <header className="sticky top-0 z-30 border-b border-black/10 bg-white">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 sm:gap-x-6 sm:py-3">
        <Link
          href="/"
          className="order-1 flex min-h-11 items-center gap-2 rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
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
        <nav
          aria-label="Main"
          className="order-4 -ml-3 flex items-center gap-1 sm:order-2 sm:ml-0"
        >
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
        <div className="order-5 ml-auto flex min-h-11 items-center sm:order-3">
          {post}
        </div>
        {/* Forces the row break on phones only. */}
        <div aria-hidden="true" className="order-3 h-0 basis-full sm:hidden" />
        <div className="order-2 ml-auto flex min-h-11 items-center sm:order-4 sm:ml-0">
          {account}
        </div>
      </div>
    </header>
  );
}

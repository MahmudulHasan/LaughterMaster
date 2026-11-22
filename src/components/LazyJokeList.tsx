"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type { JokeListItem, JokeListPage } from "@/lib/joke-list-item";

import { primaryButton, secondaryButton } from "./buttonStyles";
import { JokeCard } from "./JokeCard";

export type LazyJokeListProps = {
  /** Names the saved state for Back navigation, e.g. "all" or "u:<id>". */
  listKey: string;
  /** The server-rendered first batch. */
  initialPage: JokeListPage;
  /** One shared "now" (ISO) so server and browser print the same "3h ago". */
  now: string;
  /** Only this member's jokes (profile pages). */
  author?: string;
  /** Shown instead of the list when there are no jokes at all. */
  emptyState: ReactNode;
};

type Status = "idle" | "loading" | "error";

// ---- Back navigation (US-7: "the list returns with the jokes I'd loaded
// and my scroll position"). The App Router remounts the page on Back, so the
// loaded batches and scroll offset are kept in sessionStorage and restored
// only when this mount came from a history traversal.
let lastPopStateAt = 0;
if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    lastPopStateAt = Date.now();
  });
}

function cameFromHistory(): boolean {
  if (Date.now() - lastPopStateAt < 3000) return true;
  // A full page load from Back/Forward (bfcache miss).
  const [nav] = performance.getEntriesByType?.("navigation") ?? [];
  return (
    (nav as PerformanceNavigationTiming | undefined)?.type === "back_forward"
  );
}

type Saved = { jokes: JokeListItem[]; nextCursor: string | null; y: number };
const storageKey = (listKey: string) => `lazy-jokes:${listKey}`;

function readSaved(listKey: string): Saved | null {
  try {
    const raw = sessionStorage.getItem(storageKey(listKey));
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null; // storage blocked or corrupt: just start fresh
  }
}

function writeSaved(listKey: string, saved: Saved) {
  try {
    sessionStorage.setItem(storageKey(listKey), JSON.stringify(saved));
  } catch {
    // Quota or privacy mode: restoring is a nicety, not a requirement.
  }
}

function SkeletonCard({ wide }: { wide: boolean }) {
  return (
    <div
      data-testid="joke-skeleton"
      aria-hidden="true"
      className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white px-5.5 py-4.5"
    >
      <div className="h-3.5 w-52 animate-pulse rounded-full bg-[#EEF0F4]" />
      <div
        className={`h-4.5 animate-pulse rounded-full bg-[#EEF0F4] ${wide ? "w-11/12" : "w-4/5"}`}
      />
      {wide && (
        <div className="h-4.5 w-2/3 animate-pulse rounded-full bg-[#EEF0F4]" />
      )}
    </div>
  );
}

/**
 * Newest-first joke list loaded in batches of 20 (US-7, US-18): the first
 * batch comes from the server, the next loads automatically about one screen
 * before the end, and a Load more button is always there as the keyboard,
 * screen-reader and failure fallback.
 */
export function LazyJokeList({
  listKey,
  initialPage,
  now,
  author,
  emptyState,
}: LazyJokeListProps) {
  const [jokes, setJokes] = useState(initialPage.jokes);
  const [cursor, setCursor] = useState(initialPage.nextCursor);
  const [status, setStatus] = useState<Status>("idle");
  const [announcement, setAnnouncement] = useState("");
  const [restoreY, setRestoreY] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const scrollYRef = useRef(0);
  const nowDate = new Date(now);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !cursor) return;
    loadingRef.current = true;
    setStatus("loading");
    setAnnouncement("Loading more jokes…");
    const query = new URLSearchParams({ cursor });
    if (author) query.set("author", author);
    try {
      const res = await fetch(`/api/jokes?${query}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const page = (await res.json()) as JokeListPage;
      setJokes((shown) => {
        // Belt and braces: the cursor already rules out repeats.
        const seen = new Set(shown.map((j) => j.id));
        return [...shown, ...page.jokes.filter((j) => !seen.has(j.id))];
      });
      setCursor(page.nextCursor);
      setStatus("idle");
      const n = page.jokes.length;
      setAnnouncement(`${n} more ${n === 1 ? "joke" : "jokes"} loaded`);
    } catch {
      setStatus("error");
      setAnnouncement(""); // the error box below is its own alert
    } finally {
      loadingRef.current = false;
    }
  }, [cursor, author]);

  // Auto-load about one screen before the end. Paused after an error until
  // the reader presses Retry, so a broken network doesn't loop requests.
  const autoLoad = status === "idle" && cursor !== null;
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !autoLoad || typeof IntersectionObserver === "undefined")
      return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore();
      },
      { rootMargin: "0px 0px 100% 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [autoLoad, loadMore]);

  // Restore loaded batches before paint when arriving via Back.
  useLayoutEffect(() => {
    if (!cameFromHistory()) return;
    const saved = readSaved(listKey);
    if (!saved || saved.jokes.length <= initialPage.jokes.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore from sessionStorage, which the server render can't know about
    setJokes(saved.jokes);
    setCursor(saved.nextCursor);
    setRestoreY(saved.y);
  }, [listKey, initialPage.jokes.length]);

  // Scroll back once the restored jokes are on the page.
  useEffect(() => {
    if (restoreY === null) return;
    window.scrollTo(0, restoreY);
  }, [restoreY]);

  // Remember the scroll offset continuously: by the time this list unmounts,
  // the next page may already have reset the window to the top.
  useEffect(() => {
    const onScroll = () => {
      scrollYRef.current = window.scrollY;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Save what is shown, and the last scroll offset when leaving: on unmount
  // for in-app navigation, on `pagehide` for full page loads (no unmount).
  useEffect(() => {
    const save = () =>
      writeSaved(listKey, { jokes, nextCursor: cursor, y: scrollYRef.current });
    save();
    window.addEventListener("pagehide", save);
    return () => {
      window.removeEventListener("pagehide", save);
      save();
    };
  }, [listKey, jokes, cursor]);

  if (jokes.length === 0) return <>{emptyState}</>;

  return (
    <div className="flex flex-col gap-5">
      <ul aria-label="Jokes" className="flex flex-col gap-3">
        {jokes.map((joke) => (
          <li key={joke.id}>
            <JokeCard joke={joke} now={nowDate} />
          </li>
        ))}
      </ul>

      {status === "loading" && (
        <div className="flex flex-col gap-3">
          <SkeletonCard wide />
          <SkeletonCard wide={false} />
        </div>
      )}

      <div ref={sentinelRef} aria-hidden="true" />

      <p role="status" className="text-center text-sm text-black/65">
        {announcement}
      </p>

      {status === "error" && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-[#F0B49A] bg-[#FDEDE6] p-4">
          <p role="alert" className="font-semibold">
            Couldn&apos;t load more jokes
          </p>
          <button
            type="button"
            onClick={() => void loadMore()}
            className={secondaryButton}
          >
            Retry
          </button>
        </div>
      )}

      {cursor !== null && status !== "error" && (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={status === "loading"}
            className={`${secondaryButton} gap-2 disabled:opacity-60`}
          >
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
            Load more jokes
          </button>
        </div>
      )}

      {cursor === null && (
        <div className="flex flex-col items-center gap-2.5 border-t border-dashed border-black/20 p-6">
          <p className="text-xl font-extrabold">You&apos;ve seen every joke</p>
          <Link href="/post" className={primaryButton}>
            Post the next one
          </Link>
        </div>
      )}
    </div>
  );
}

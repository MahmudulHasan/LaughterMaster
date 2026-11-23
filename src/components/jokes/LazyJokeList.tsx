"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { primaryButton, secondaryButton } from "@/components/buttonStyles";
import type { JokePage, JokeView } from "@/server/jokes/types";

import { JokeCard } from "./JokeCard";

export type LazyJokeListProps = {
  /** The server-rendered first batch, so the page works before any script runs. */
  initialPage: JokePage;
  /** Read endpoint returning `JokePage` JSON for `?cursor=`, e.g. "/api/jokes". */
  endpoint: string;
  /**
   * sessionStorage key for restoring loaded jokes and scroll on Back (D12).
   * Use the list URL, plus anything that changes what the list contains
   * (e.g. the owner's view of a profile).
   */
  storageKey: string;
  /** Shown instead of the list when the first batch is empty. */
  emptyState?: ReactNode;
};

type Status = "idle" | "loading" | "error";

type Stored = {
  v: 2;
  jokes: JokeView[];
  nextCursor: string | null;
  /**
   * Server cursors seen after a batch, keyed by that batch's last joke id.
   * They let a truncated list keep paging from where it was cut (cursors
   * need the server's microsecond timestamps, which JokeView doesn't carry).
   */
  cursors: Array<[string, string]>;
  scrollY: number;
};

const STORAGE_PREFIX = "lm:list:";
/** Keeps the stored list well under sessionStorage quotas. */
const MAX_STORED_JOKES = 500;
/** history.state field marking the entry whose list may be restored. */
const HISTORY_MARK = "__lmList";
/**
 * Identifies this document. A mark written by this document means a
 * client-side traversal (Back/Forward) reached the entry; a mark from another
 * document means a full load, which restores only on back_forward.
 */
const DOCUMENT_ID = Math.random().toString(36).slice(2);

type HistoryMark = { key: string; doc: string };

function readStored(key: string): Stored | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored> | null;
    if (
      !parsed ||
      parsed.v !== 2 ||
      !Array.isArray(parsed.jokes) ||
      !Array.isArray(parsed.cursors) ||
      (parsed.nextCursor !== null && typeof parsed.nextCursor !== "string")
    ) {
      return null;
    }
    return {
      v: 2,
      jokes: parsed.jokes,
      nextCursor: parsed.nextCursor,
      cursors: parsed.cursors.filter(
        (entry): entry is [string, string] =>
          Array.isArray(entry) &&
          typeof entry[0] === "string" &&
          typeof entry[1] === "string",
      ),
      scrollY: typeof parsed.scrollY === "number" ? parsed.scrollY : 0,
    };
  } catch {
    // Storage disabled, blocked or corrupted: behave as a fresh visit.
    return null;
  }
}

function writeStored(key: string, value: Stored) {
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota exceeded or storage blocked: restoring is a nicety, not required.
  }
}

function clearStored(key: string) {
  try {
    window.sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // Storage blocked: nothing to clear.
  }
}

function readMark(): HistoryMark | null {
  const state: unknown = window.history.state;
  if (!state || typeof state !== "object") return null;
  const mark = (state as Record<string, unknown>)[HISTORY_MARK];
  if (!mark || typeof mark !== "object") return null;
  const { key, doc } = mark as Record<string, unknown>;
  return typeof key === "string" && typeof doc === "string"
    ? { key, doc }
    : null;
}

/**
 * Marks the current history entry as showing this list. Next.js keeps custom
 * history.state fields when it handles Back/Forward, and starts every pushed
 * entry without them, so only a return to this very entry finds the mark.
 */
function writeMark(key: string) {
  const current = readMark();
  if (current?.key === key && current.doc === DOCUMENT_ID) return;
  try {
    const state: unknown = window.history.state;
    window.history.replaceState(
      {
        ...(state && typeof state === "object" ? state : {}),
        [HISTORY_MARK]: { key, doc: DOCUMENT_ID } satisfies HistoryMark,
      },
      "",
    );
  } catch {
    // replaceState can throw if called too often; restoring is optional.
  }
}

function navigationType(): string | undefined {
  try {
    const [entry] = performance.getEntriesByType("navigation");
    return (entry as PerformanceNavigationTiming | undefined)?.type;
  } catch {
    return undefined;
  }
}

/**
 * True when the user came back to this list with Back/Forward (D12), not by a
 * link, a redirect or a reload. Those show the fresh server batch instead, so
 * deleted or hidden jokes never come back from storage.
 */
function isReturnVisit(key: string): boolean {
  const mark = readMark();
  if (mark?.key !== key) return false;
  if (mark.doc === DOCUMENT_ID) return true;
  return navigationType() === "back_forward";
}

/** Newest first, ties by id desc: the same order the queries use. */
function compareJokes(a: JokeView, b: JokeView): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}

/** Appends jokes whose id isn't already shown (defensive dedupe). */
function appendUnique(current: JokeView[], incoming: JokeView[]): JokeView[] {
  const seen = new Set(current.map((joke) => joke.id));
  const added: JokeView[] = [];
  for (const joke of incoming) {
    if (!seen.has(joke.id)) {
      seen.add(joke.id);
      added.push(joke);
    }
  }
  return added.length ? [...current, ...added] : current;
}

type Restored = JokePage & { cursors: Map<string, string> };

/**
 * Combines the fresh first batch with what was loaded before Back. The fresh
 * batch is the truth for its own range: stored jokes inside it that it no
 * longer has (deleted, hidden) are dropped. Only stored jokes older than the
 * fresh batch are kept after it. If the stored list starts below the fresh
 * batch, more jokes than one batch arrived meanwhile and there may be a gap,
 * so the stored jokes are dropped entirely.
 */
function mergeRestored(fresh: JokePage, stored: Stored): Restored | null {
  const cursors = new Map<string, string>();
  const freshLast = fresh.jokes.at(-1);
  if (freshLast && fresh.nextCursor !== null) {
    cursors.set(freshLast.id, fresh.nextCursor);
  }
  // The fresh batch already holds the whole list.
  if (!freshLast || fresh.nextCursor === null) {
    return { jokes: fresh.jokes, nextCursor: fresh.nextCursor, cursors };
  }
  const storedFirst = stored.jokes[0];
  if (!storedFirst || compareJokes(storedFirst, freshLast) > 0) return null;
  const older = stored.jokes
    .filter((joke) => compareJokes(joke, freshLast) > 0)
    .sort(compareJokes);
  if (older.length === 0) {
    return { jokes: fresh.jokes, nextCursor: fresh.nextCursor, cursors };
  }
  const keptIds = new Set(older.map((joke) => joke.id));
  for (const [id, cursor] of stored.cursors) {
    if (keptIds.has(id)) cursors.set(id, cursor);
  }
  return {
    jokes: [...fresh.jokes, ...older],
    nextCursor: stored.nextCursor,
    cursors,
  };
}

/**
 * What to store: at most MAX_STORED_JOKES, cut right after a batch so the
 * server cursor for that point is known and Back can keep paging from it.
 */
function toStored(
  jokes: JokeView[],
  nextCursor: string | null,
  cursors: Map<string, string>,
  scrollY: number,
): Stored | null {
  let kept = jokes;
  let cursor = nextCursor;
  if (jokes.length > MAX_STORED_JOKES) {
    let cut = -1;
    for (let i = MAX_STORED_JOKES - 1; i >= 0; i--) {
      if (cursors.has(jokes[i]!.id)) {
        cut = i;
        break;
      }
    }
    if (cut < 0) return null;
    kept = jokes.slice(0, cut + 1);
    cursor = cursors.get(jokes[cut]!.id)!;
  }
  const keptIds = new Set(kept.map((joke) => joke.id));
  return {
    v: 2,
    jokes: kept,
    nextCursor: cursor,
    cursors: [...cursors].filter(([id]) => keptIds.has(id)),
    scrollY,
  };
}

function isJokePage(value: unknown): value is JokePage {
  if (!value || typeof value !== "object") return false;
  const page = value as Partial<JokePage>;
  return (
    Array.isArray(page.jokes) &&
    (page.nextCursor === null || typeof page.nextCursor === "string")
  );
}

function SkeletonCard() {
  return (
    <div
      aria-hidden="true"
      data-testid="joke-skeleton"
      className="animate-pulse rounded-2xl border border-[#E3E5EA] bg-white p-5"
    >
      <div className="flex items-center gap-3">
        <div className="size-8 rounded-full bg-[#EEF0F4]" />
        <div className="h-3 w-28 rounded bg-[#EEF0F4]" />
        <div className="h-3 w-16 rounded bg-[#EEF0F4]" />
      </div>
      <div className="mt-4 h-4 w-11/12 rounded bg-[#EEF0F4]" />
      <div className="mt-2 h-4 w-2/3 rounded bg-[#EEF0F4]" />
    </div>
  );
}

/**
 * Lazily loaded joke list (US-7, US-18, D12). Starts from the server-rendered
 * first batch, auto-loads the next one when the end is about one screen away,
 * and always offers a "Load more jokes" button as the fallback.
 */
export function LazyJokeList({
  initialPage,
  endpoint,
  storageKey,
  emptyState,
}: LazyJokeListProps) {
  const [jokes, setJokes] = useState<JokeView[]>(initialPage.jokes);
  const [nextCursor, setNextCursor] = useState(initialPage.nextCursor);
  const [status, setStatus] = useState<Status>("idle");
  const [announcement, setAnnouncement] = useState("");
  // Persisting starts only after the restore attempt, so the first render's
  // state never overwrites what Back should bring back.
  const [restored, setRestored] = useState(false);

  // Latest jokes for loadMore, which appends outside a state updater so it
  // can announce how many were really added.
  const jokesRef = useRef(jokes);
  useEffect(() => {
    jokesRef.current = jokes;
  }, [jokes]);
  // Server cursors by the id of the joke they follow (see Stored.cursors).
  const cursorsRef = useRef(new Map<string, string>());
  const inFlight = useRef(false);
  const mounted = useRef(false);
  // Bumped whenever the list is reset, so a batch requested before then is
  // ignored instead of being appended to the wrong list.
  const generation = useRef(0);
  const pendingScroll = useRef<number | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // Decide between the fresh server batch and the stored list. Runs after
  // hydration (sessionStorage and history.state don't exist on the server),
  // and again whenever Next.js shows this page from its hidden <Activity>
  // cache (cacheComponents), where state from the earlier visit survives; so
  // it always sets the list explicitly. Idempotent, so StrictMode's double
  // run is harmless: a normal visit clears the entry it would otherwise read.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    generation.current += 1;
    inFlight.current = false;
    const stored = isReturnVisit(storageKey) ? readStored(storageKey) : null;
    const merged = stored ? mergeRestored(initialPage, stored) : null;
    if (stored && merged) {
      cursorsRef.current = merged.cursors;
      jokesRef.current = merged.jokes;
      setJokes(merged.jokes);
      setNextCursor(merged.nextCursor);
      pendingScroll.current = stored.scrollY;
    } else {
      if (!stored) clearStored(storageKey);
      const cursors = new Map<string, string>();
      const last = initialPage.jokes.at(-1);
      if (last && initialPage.nextCursor !== null) {
        cursors.set(last.id, initialPage.nextCursor);
      }
      cursorsRef.current = cursors;
      jokesRef.current = initialPage.jokes;
      setJokes(initialPage.jokes);
      setNextCursor(initialPage.nextCursor);
    }
    setStatus("idle");
    setAnnouncement("");
    setRestored(true);
    // Hidden by <Activity> or unmounted: the next showing must decide again
    // before anything is persisted over the stored list.
    return () => setRestored(false);
  }, [storageKey, initialPage]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Scroll back once the restored jokes are in the DOM.
  useEffect(() => {
    if (!restored || pendingScroll.current === null) return;
    const y = pendingScroll.current;
    pendingScroll.current = null;
    window.scrollTo(0, y);
  }, [restored, jokes]);

  // Persist loaded jokes, cursor and scroll position, and mark this history
  // entry as the one Back should restore.
  useEffect(() => {
    if (!restored) return;
    // After a client-side navigation away, a late scroll event must not
    // write this list's state onto the next page's history entry.
    const path = window.location.pathname;
    const save = () => {
      if (window.location.pathname !== path) return;
      const value = toStored(
        jokes,
        nextCursor,
        cursorsRef.current,
        window.scrollY,
      );
      if (value) writeStored(storageKey, value);
      else clearStored(storageKey);
      writeMark(storageKey);
    };
    save();
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        save();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pagehide", save);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pagehide", save);
    };
  }, [restored, storageKey, jokes, nextCursor]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (inFlight.current || nextCursor === null) return;
    inFlight.current = true;
    const requested = generation.current;
    setStatus("loading");
    setAnnouncement("Loading more jokes…");
    try {
      const url = `${endpoint}?cursor=${encodeURIComponent(nextCursor)}`;
      const response = await fetch(url, {
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const page: unknown = await response.json();
      if (!isJokePage(page)) throw new Error("Unexpected response");
      if (!mounted.current || requested !== generation.current) return;
      const current = jokesRef.current;
      const next = appendUnique(current, page.jokes);
      const count = next.length - current.length;
      jokesRef.current = next;
      setJokes(next);
      const last = page.jokes.at(-1);
      if (last && page.nextCursor !== null) {
        cursorsRef.current.set(last.id, page.nextCursor);
      }
      setNextCursor(page.nextCursor);
      setStatus("idle");
      setAnnouncement(
        count === 1 ? "1 more joke loaded" : `${count} more jokes loaded`,
      );
    } catch {
      if (!mounted.current || requested !== generation.current) return;
      setStatus("error");
      setAnnouncement("Couldn't load more jokes");
    } finally {
      if (requested === generation.current) inFlight.current = false;
    }
  }, [endpoint, nextCursor]);

  // Auto-load when the end is within about one viewport. Re-created after
  // each batch so a still-visible sentinel triggers the next one; paused on
  // error so a failing endpoint isn't hammered (the buttons still work).
  const hasMore = nextCursor !== null;
  useEffect(() => {
    if (!restored || !hasMore || status !== "idle") return;
    const target = sentinel.current;
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "0px 0px 100% 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [restored, hasMore, status, jokes.length, loadMore]);

  if (jokes.length === 0 && !hasMore) {
    return <>{emptyState}</>;
  }

  return (
    <div>
      <ul className="flex flex-col gap-4">
        {jokes.map((joke) => (
          <li key={joke.id}>
            <JokeCard joke={joke} />
          </li>
        ))}
      </ul>

      {status === "loading" && (
        <div className="mt-4 flex flex-col gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      <div ref={sentinel} aria-hidden="true" className="h-px" />

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {status === "error" && (
        // The live region above announces the failure; no role="alert" here
        // so screen readers don't hear it twice.
        <div
          data-testid="load-error"
          className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-[#E3E5EA] bg-white p-4"
        >
          <p className="font-medium">Couldn&apos;t load more jokes</p>
          <button
            type="button"
            className={secondaryButton}
            onClick={() => void loadMore()}
          >
            Retry
          </button>
        </div>
      )}

      {hasMore ? (
        status !== "error" && (
          <div className="mt-6 flex justify-center">
            <button
              type="button"
              className={`${secondaryButton} w-full sm:w-auto`}
              aria-disabled={status === "loading"}
              onClick={() => void loadMore()}
            >
              Load more jokes
            </button>
          </div>
        )
      ) : (
        <div className="mt-8 flex flex-col items-center gap-3 text-center">
          <p className="text-black/70">You&apos;ve seen every joke</p>
          <Link href="/post" className={primaryButton}>
            Post the next one
          </Link>
        </div>
      )}
    </div>
  );
}

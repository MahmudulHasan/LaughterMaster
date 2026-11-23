"use client";

import { useEffect, useState } from "react";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const absoluteDate = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const fullDateTime = new Intl.DateTimeFormat("en", {
  dateStyle: "long",
  timeStyle: "short",
});

/**
 * "just now", "5 minutes ago", "3 hours ago", "yesterday", "4 days ago",
 * then an absolute date ("Mar 3, 2026") from 7 days on. Pure, so it's testable.
 */
export function formatRelativeTime(iso: string, now: number): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  // Clock skew can put a fresh joke slightly in the future; treat it as now.
  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE) return "just now";
  if (elapsed < HOUR)
    return relative.format(-Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY)
    return relative.format(-Math.floor(elapsed / HOUR), "hour");
  if (elapsed < 7 * DAY)
    return relative.format(-Math.floor(elapsed / DAY), "day");
  return absoluteDate.format(new Date(time));
}

/**
 * A `<time>` showing how long ago something happened. The server and the
 * browser may compute different text (clock and render time differ), so the
 * text is hydration-warning-suppressed (the server's text stays until the
 * first tick) and recomputed every minute. Needs no Suspense boundary.
 */
export function RelativeTime({
  iso,
  prefix = "",
  className,
}: {
  iso: string;
  /** Text before the relative time, e.g. "Posted ". */
  prefix?: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // StrictMode's double run just restarts the interval.
    const id = window.setInterval(() => setNow(Date.now()), MINUTE);
    return () => window.clearInterval(id);
  }, []);

  const date = new Date(iso);
  const title = Number.isNaN(date.getTime())
    ? undefined
    : fullDateTime.format(date);

  return (
    <time
      dateTime={iso}
      title={title}
      className={className}
      suppressHydrationWarning
    >
      {prefix}
      {formatRelativeTime(iso, now)}
    </time>
  );
}

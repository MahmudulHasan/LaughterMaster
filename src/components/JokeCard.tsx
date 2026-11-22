import Link from "next/link";
import type { ReactNode } from "react";

import type { JokeListItem } from "@/lib/joke-list-item";
import { formatRelativeTime } from "@/lib/relative-time";

import { Avatar } from "./Avatar";

/**
 * One joke in a list (US-7, US-18): author linked to their profile, AI badge,
 * category, relative time linking to the joke page, and the text. Vote and
 * share controls arrive in M4 and M7. Never shows vote counts.
 *
 * `underReview` is the owner-only view of a pending joke (US-18): marked,
 * explained, and not linked, since its page isn't public yet. `actions` sits
 * at the end of the top row (the owner's Delete).
 */
export function JokeCard({
  joke,
  now,
  underReview = false,
  actions,
}: {
  joke: JokeListItem;
  now: Date;
  underReview?: boolean;
  actions?: ReactNode;
}) {
  const ago = formatRelativeTime(new Date(joke.createdAt), now);
  const time = <time dateTime={joke.createdAt}>{ago}</time>;
  return (
    <article
      className={`flex flex-col gap-3 rounded-2xl border bg-white px-5.5 py-4.5 ${
        underReview ? "border-[#E8C766]" : "border-black/10"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2.5 text-sm text-black/65">
        {underReview && (
          <span className="rounded-full bg-[#FFF1C7] px-2.5 py-0.5 text-[13px] font-semibold text-[#6B4A00]">
            Under review
          </span>
        )}
        <Link
          href={`/u/${joke.author.id}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl font-semibold text-[#15161A] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
        >
          <Avatar
            user={{
              name: joke.author.displayName,
              image: joke.author.avatarUrl,
            }}
            size={28}
          />
          {joke.author.displayName}
        </Link>
        {joke.isBot && (
          <span className="rounded-full bg-[#15161A] px-2 py-0.5 text-xs font-bold text-white">
            AI
          </span>
        )}
        {joke.category && (
          <span className="rounded-full bg-[#EEF0F4] px-2.5 py-0.5 text-[13px] font-medium text-black/75">
            {joke.category}
          </span>
        )}
        {underReview ? (
          <span className="inline-flex min-h-11 items-center">{time}</span>
        ) : (
          <Link
            href={`/joke/${joke.id}`}
            className="inline-flex min-h-11 items-center rounded-xl hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
          >
            {time}
            <span className="sr-only">, open this joke</span>
          </Link>
        )}
        {actions && <div className="ml-auto">{actions}</div>}
      </div>
      <p className="text-lg leading-relaxed break-words whitespace-pre-line">
        {joke.text}
      </p>
      {underReview && (
        <p className="text-sm text-black/65">
          We&apos;re checking your joke. It&apos;ll appear publicly shortly.
        </p>
      )}
    </article>
  );
}

import Link from "next/link";

import type { JokeListItem } from "@/lib/joke-list-item";
import { formatRelativeTime } from "@/lib/relative-time";

import { Avatar } from "./Avatar";

/**
 * One joke in a list (US-7, US-18): author linked to their profile, AI badge,
 * category, relative time linking to the joke page, and the text. Vote and
 * share controls arrive in M4 and M7. Never shows vote counts.
 */
export function JokeCard({ joke, now }: { joke: JokeListItem; now: Date }) {
  const ago = formatRelativeTime(new Date(joke.createdAt), now);
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white px-5.5 py-4.5">
      <div className="flex flex-wrap items-center gap-2.5 text-sm text-black/65">
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
        <Link
          href={`/joke/${joke.id}`}
          className="inline-flex min-h-11 items-center rounded-xl hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
        >
          <time dateTime={joke.createdAt}>{ago}</time>
          <span className="sr-only">, open this joke</span>
        </Link>
      </div>
      <p className="text-lg leading-relaxed break-words whitespace-pre-line">
        {joke.text}
      </p>
    </article>
  );
}

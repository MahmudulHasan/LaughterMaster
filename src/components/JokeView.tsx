import Link from "next/link";

import { formatRelativeTime } from "@/lib/relative-time";
import type { PublicJoke } from "@/server/jokes/read";

import { Avatar } from "./Avatar";

/**
 * The joke page's main card (US-6): category, text, author (linked to their
 * profile) and relative post time. Vote buttons arrive in M4, share in M7.
 */
export function JokeView({ joke, now }: { joke: PublicJoke; now: Date }) {
  return (
    <article className="flex flex-col gap-7 rounded-3xl border border-black/10 bg-white p-6 sm:p-10">
      {joke.category && (
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-full bg-[#EEF0F4] px-3 py-1 text-sm font-medium text-black/75">
            {joke.category}
          </span>
        </div>
      )}
      <p className="text-2xl leading-snug font-semibold tracking-tight break-words whitespace-pre-line sm:text-4xl">
        {joke.text}
      </p>
      <Link
        href={`/u/${joke.author.id}`}
        className="inline-flex items-center gap-3 self-start rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
      >
        <Avatar
          user={{ name: joke.author.displayName, image: joke.author.avatarUrl }}
          size={44}
        />
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">{joke.author.displayName}</span>
          <span className="text-sm text-black/65">
            Posted{" "}
            <time dateTime={joke.createdAt.toISOString()}>
              {formatRelativeTime(joke.createdAt, now)}
            </time>
          </span>
        </span>
      </Link>
    </article>
  );
}

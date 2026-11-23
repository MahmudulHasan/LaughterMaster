import Link from "next/link";
import type { ReactNode } from "react";

import type { JokeView } from "@/server/jokes/types";

import { AiBadge } from "./AiBadge";
import { AuthorLink } from "./AuthorLink";
import { CategoryChip } from "./CategoryChip";
import { RelativeTime } from "./RelativeTime";
import { UnderReviewChip } from "./UnderReviewChip";

export type JokeCardProps = {
  joke: JokeView;
  /** Footer slot: Delete now, vote and share controls in M4/M7. */
  actions?: ReactNode;
  /** Link the relative time to /joke/<id>. Pass false on the joke page. */
  linkToJoke?: boolean;
  as?: "article" | "div";
};

/**
 * One joke in a list. Usable from Server and Client Components (no server
 * imports). Shows no email and no vote counts (intent #5, D13).
 */
export function JokeCard({
  joke,
  actions,
  linkToJoke = true,
  as: Tag = "article",
}: JokeCardProps) {
  const time = <RelativeTime iso={joke.createdAt} />;
  return (
    <Tag
      aria-label={`Joke by ${joke.author.displayName}`}
      className="rounded-2xl border border-[#E3E5EA] bg-white p-5"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <AuthorLink author={joke.author} />
        {joke.isBot && <AiBadge />}
        {joke.category && <CategoryChip category={joke.category} />}
        {joke.status === "pending" && <UnderReviewChip />}
        <span className="text-black/60">
          {linkToJoke ? (
            <Link
              href={`/joke/${encodeURIComponent(joke.id)}`}
              className="inline-flex min-h-11 items-center rounded hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
            >
              {time}
            </Link>
          ) : (
            time
          )}
        </span>
      </div>
      <p className="mt-2 text-lg leading-relaxed break-words whitespace-pre-line text-[#15161A]">
        {joke.text}
      </p>
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </Tag>
  );
}

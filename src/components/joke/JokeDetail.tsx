import Link from "next/link";

import { AiBadge } from "@/components/jokes/AiBadge";
import { AuthorLink } from "@/components/jokes/AuthorLink";
import { CategoryChip } from "@/components/jokes/CategoryChip";
import { RelativeTime } from "@/components/jokes/RelativeTime";
import { UnderReviewChip } from "@/components/jokes/UnderReviewChip";
import { VoteButtons, type Voter } from "@/components/votes/VoteButtons";
import type { SignInOptions } from "@/server/auth/types";
import type { JokeView } from "@/server/jokes/types";

import { ShareButton } from "@/components/share/ShareButton";

import { DeleteJokeButton } from "./DeleteJokeButton";
import { ReportButton } from "./ReportButton";

export type JokeDetailProps = {
  joke: JokeView;
  /** True when the signed-in viewer wrote this joke. */
  isAuthor: boolean;
  /** The viewer is an admin, who may delete anyone's joke (US-16). */
  isAdmin?: boolean;
  /** Report (US-15); omitted for the author and unpublished jokes. */
  report?: "visitor" | "member" | "reported";
  /** Like/Dislike (US-8); omitted for jokes that can't be voted on. */
  votes?: { voter: Voter; signInOptions: SignInOptions };
};

/** The big single-joke layout of `/joke/<id>` (US-6). */
export function JokeDetail({
  joke,
  isAuthor,
  isAdmin = false,
  report,
  votes,
}: JokeDetailProps) {
  const pending = joke.status === "pending";
  return (
    <>
      <Link
        href="/jokes"
        className="inline-flex min-h-11 items-center gap-1 rounded-xl px-2 font-medium text-black/70 hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
      >
        <span aria-hidden="true">←</span> Back
      </Link>
      <article
        aria-labelledby="joke-heading"
        className="mt-4 rounded-3xl border border-black/10 bg-white p-6 shadow-sm sm:p-10"
      >
        {/* A joke can be long, so the page heading is a short hidden label and
            the joke itself stays a paragraph. */}
        <h1 id="joke-heading" className="sr-only">
          Joke by {joke.author.displayName}
        </h1>
        {(pending || joke.isBot || joke.category) && (
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {pending && <UnderReviewChip />}
            {joke.isBot && <AiBadge />}
            {joke.category && <CategoryChip category={joke.category} />}
          </div>
        )}
        <p className="text-[28px] leading-snug font-semibold tracking-tight break-words whitespace-pre-line sm:text-[38px]">
          {joke.text}
        </p>
        {pending && isAuthor && (
          <p
            role="note"
            className="mt-5 rounded-xl bg-[#FFF1D6] p-3 text-sm text-[#7A4B00]"
          >
            Under review: only you can see this joke until it&apos;s approved.
          </p>
        )}
        <footer className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-black/10 pt-5">
          <AuthorLink author={joke.author} size={40} />
          <span className="text-sm text-black/60">
            <RelativeTime iso={joke.createdAt} prefix="Posted " />
          </span>
          <div data-slot="joke-actions" className="ml-auto flex gap-2">
            {joke.status === "approved" && (
              <ShareButton jokeId={joke.id} text={joke.text} />
            )}
            {isAuthor ? (
              <DeleteJokeButton jokeId={joke.id} />
            ) : (
              isAdmin && <DeleteJokeButton jokeId={joke.id} asAdmin />
            )}
          </div>
          {votes && joke.status === "approved" && (
            <div className="w-full pt-2">
              <VoteButtons
                jokeId={joke.id}
                myVote={joke.myVote}
                voter={votes.voter}
                signInOptions={votes.signInOptions}
              />
            </div>
          )}
        </footer>
      </article>
      {report && votes && joke.status === "approved" && (
        <div className="mt-4">
          <ReportButton
            jokeId={joke.id}
            state={report}
            signInOptions={votes.signInOptions}
          />
        </div>
      )}
    </>
  );
}

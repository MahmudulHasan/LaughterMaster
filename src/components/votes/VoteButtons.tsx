"use client";

import { useState } from "react";

import { SignInButton } from "@/components/SignInButton";
import type { SignInOptions } from "@/server/auth/types";
import type { VoteValue } from "@/server/jokes/types";

/** Who is looking at the joke, from the vote buttons' point of view. */
export type Voter = "visitor" | "member" | "author";

export type VoteButtonsProps = {
  jokeId: string;
  /** The viewer's current vote; null or undefined means none. */
  myVote?: VoteValue | null;
  voter: Voter;
  /** For the sign-in dialog shown to visitors. */
  signInOptions: SignInOptions;
  /**
   * Called with the vote the server saved, so a parent list can keep its
   * copy in sync (e.g. what Back restores).
   */
  onVote?: (myVote: VoteValue | null) => void;
};

const base =
  "inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]";
const idle = `${base} border-black/20 bg-white text-[#15161A] hover:bg-black/5`;
const liked = `${base} border-[#2B4FD8] bg-[#2B4FD8] text-white`;
const disliked = `${base} border-[#B4400C] bg-[#B4400C] text-white`;
const disabled = `${base} cursor-not-allowed border-black/10 bg-white text-black/40`;

export const OWN_JOKE_NOTE = "You can't vote on your own joke";

function ThumbIcon({ down = false }: { down?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform={down ? "rotate(180 12 12)" : undefined}>
        <path d="M7 10v11H4a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h3zm0 0 4-7a2 2 0 0 1 2.9 1.9L13 9h5.6a2 2 0 0 1 2 2.3l-1.3 8a2 2 0 0 1-2 1.7H7" />
      </g>
    </svg>
  );
}

/**
 * Like / Dislike for one joke (US-8). Visitors get the sign-in dialog;
 * authors see disabled buttons; members toggle with an optimistic update
 * that rolls back if the server refuses. Never shows counts (intent #5).
 */
export function VoteButtons({
  jokeId,
  myVote,
  voter,
  signInOptions,
  onVote,
}: VoteButtonsProps) {
  const [vote, setVote] = useState<VoteValue | null>(myVote ?? null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  if (voter === "visitor") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <SignInButton action="like" options={signInOptions} className={idle}>
          <ThumbIcon />
          Like
        </SignInButton>
        <SignInButton action="dislike" options={signInOptions} className={idle}>
          <ThumbIcon down />
          Dislike
        </SignInButton>
      </div>
    );
  }

  if (voter === "author") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled
          title={OWN_JOKE_NOTE}
          className={disabled}
        >
          <ThumbIcon />
          Like
        </button>
        <button
          type="button"
          disabled
          title={OWN_JOKE_NOTE}
          className={disabled}
        >
          <ThumbIcon down />
          Dislike
        </button>
        <span className="text-sm text-black/60">{OWN_JOKE_NOTE}</span>
      </div>
    );
  }

  async function cast(value: VoteValue) {
    if (pending) return;
    const previous = vote;
    setVote(previous === value ? null : value); // optimistic
    setPending(true);
    setMessage("");
    try {
      const res = await fetch(`/api/jokes/${encodeURIComponent(jokeId)}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (res.ok) {
        const data = (await res.json()) as { myVote: VoteValue | null };
        setVote(data.myVote);
        onVote?.(data.myVote);
      } else {
        setVote(previous);
        setMessage(
          res.status === 401
            ? "Your session ended. Sign in again to vote."
            : res.status === 404
              ? "This joke isn't available any more."
              : "Couldn't save your vote. Try again.",
        );
      }
    } catch {
      setVote(previous);
      setMessage("Couldn't save your vote. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={vote === 1}
        onClick={() => cast(1)}
        className={vote === 1 ? liked : idle}
      >
        <ThumbIcon />
        {vote === 1 ? "Liked" : "Like"}
      </button>
      <button
        type="button"
        aria-pressed={vote === -1}
        onClick={() => cast(-1)}
        className={vote === -1 ? disliked : idle}
      >
        <ThumbIcon down />
        {vote === -1 ? "Disliked" : "Dislike"}
      </button>
      <span role="status" className="text-sm text-[#B4400C]">
        {message}
      </span>
    </div>
  );
}

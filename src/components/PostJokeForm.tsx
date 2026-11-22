"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { postJokeAction, type PostJokeState } from "@/app/post/actions";
import {
  JOKE_MAX_LENGTH,
  JOKE_MIN_LENGTH,
  POSTS_PER_DAY,
  TOO_LONG_MESSAGE,
  TOO_SHORT_MESSAGE,
  countGraphemes,
} from "@/server/jokes/text";

import { primaryButton } from "./buttonStyles";

export type PostJokeFormProps = {
  /** Posts left in the rolling 24h window when the page loaded. */
  remaining: number;
  /** ISO time posting reopens, when `remaining` is 0. */
  retryAt: string | null;
};

/** "at 3:42 PM", or "tomorrow at 3:42 PM", in the viewer's time zone. */
function formatRetryAt(iso: string): string {
  const when = new Date(iso);
  const time = when.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return when.toDateString() === new Date().toDateString()
    ? `at ${time}`
    : `tomorrow at ${time}`;
}

/**
 * The post form (US-4). The counter and 10–500 rule run in the browser for
 * quick feedback; the server action checks everything again.
 */
export function PostJokeForm({ remaining, retryAt }: PostJokeFormProps) {
  const [text, setText] = useState("");
  const initialState: PostJokeState = retryAt
    ? { status: "rate_limited", retryAt }
    : { status: "idle" };
  const [state, formAction, pending] = useActionState(
    async (previous: PostJokeState, formData: FormData) => {
      const next = await postJokeAction(previous, formData);
      if (next.status === "posted") setText("");
      return next;
    },
    initialState,
  );

  const count = countGraphemes(text.trim());
  const tooShort = count > 0 && count < JOKE_MIN_LENGTH;
  const tooLong = count > JOKE_MAX_LENGTH;
  const valid = count >= JOKE_MIN_LENGTH && !tooLong;
  const limited = state.status === "rate_limited";
  const left = state.status === "posted" ? state.remaining : remaining;

  const help = tooShort
    ? TOO_SHORT_MESSAGE
    : tooLong
      ? TOO_LONG_MESSAGE
      : `Between ${JOKE_MIN_LENGTH} and ${JOKE_MAX_LENGTH} characters.`;

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 rounded-2xl border border-black/10 bg-white p-7"
    >
      <label htmlFor="joke-text" className="font-semibold">
        Your joke
      </label>
      <textarea
        id="joke-text"
        name="text"
        rows={6}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Why did the…"
        aria-describedby="joke-help joke-count"
        aria-invalid={tooShort || tooLong}
        className={`w-full resize-y rounded-xl border-2 p-4 text-lg leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8] ${
          tooShort || tooLong ? "border-[#B4400C]" : "border-[#C9CDD6]"
        }`}
      />
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <p
          id="joke-help"
          className={tooShort || tooLong ? "text-[#B4400C]" : "text-black/65"}
        >
          {help}
        </p>
        <p
          id="joke-count"
          className={`tabular-nums ${tooLong ? "text-[#B4400C]" : "text-black/65"}`}
        >
          {count} / {JOKE_MAX_LENGTH}
        </p>
      </div>

      <ul className="flex list-disc flex-col gap-1.5 rounded-xl bg-[#F5F6F8] py-3.5 pr-4 pl-8 text-sm leading-normal text-black/75">
        <li>
          Keep it friendly: no jokes that target groups of people or real
          private individuals.
        </li>
        <li>Post your own jokes. Reposts of existing jokes are blocked.</li>
        <li>Any language is welcome.</li>
        <li>You can delete a joke later, but you can’t edit it.</li>
      </ul>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!valid || pending || limited}
          className={`${primaryButton} min-h-12 px-6 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {pending ? "Posting…" : "Post joke"}
        </button>
        <span className="text-sm text-black/65">
          {left} of {POSTS_PER_DAY} posts left today
        </span>
      </div>

      {state.status === "posted" && (
        <div
          role="status"
          className="flex flex-col gap-1 rounded-xl border border-[#9BD3B5] bg-[#E6F6EE] px-4.5 py-4"
        >
          <p className="font-bold">Your joke is live!</p>
          <Link
            href={`/joke/${state.jokeId}`}
            className="text-sm font-semibold text-[#2B4FD8] underline-offset-2 hover:underline"
          >
            See your joke
          </Link>
        </div>
      )}
      {state.status === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-[#F0B49A] bg-[#FDEDE6] px-4.5 py-4 text-sm"
        >
          {state.message}
        </div>
      )}
      {limited && (
        <div
          role="alert"
          className="flex flex-col gap-1 rounded-xl border border-[#E8C766] bg-[#FFF6DB] px-4.5 py-4"
        >
          <p className="font-bold">That’s today’s limit</p>
          <p className="text-sm text-black/75">
            You&apos;ve posted {POSTS_PER_DAY} jokes in the last 24 hours. You
            can post again {formatRetryAt(state.retryAt)}.
          </p>
        </div>
      )}
    </form>
  );
}

"use client";

import { useActionState, useId, useState } from "react";

import { primaryButton } from "@/components/buttonStyles";
import {
  createJokeAction,
  type CreateJokeFormState,
} from "@/server/jokes/actions";
import {
  JOKE_MAX_LENGTH,
  JOKE_MIN_LENGTH,
  POSTS_PER_DAY,
  jokeLength,
} from "@/server/jokes/types";

export type LengthState = "empty" | "short" | "ok" | "long";

export function lengthState(length: number): LengthState {
  if (length === 0) return "empty";
  if (length < JOKE_MIN_LENGTH) return "short";
  if (length > JOKE_MAX_LENGTH) return "long";
  return "ok";
}

const RANGE = `Between ${JOKE_MIN_LENGTH} and ${JOKE_MAX_LENGTH} characters.`;

/** Help text under the textarea for each length state. */
export function lengthHint(state: LengthState): string {
  if (state === "short") return `A bit short… ${RANGE}`;
  if (state === "long") return `Too long… ${RANGE}`;
  return RANGE;
}

const timeFormat = new Intl.DateTimeFormat("en", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** Friendly copy for an error the server action returned. */
export function serverErrorMessage(state: NonNullable<CreateJokeFormState>) {
  switch (state.error) {
    case "not_signed_in":
      return "Your session ended. Sign in again to post your joke.";
    case "too_short":
      return `That joke is a bit short. ${RANGE}`;
    case "too_long":
      return `That joke is too long. ${RANGE}`;
    case "duplicate":
      return "This joke is already on LaughterMaster, so it can't be posted again.";
    case "rejected":
      return `We couldn't post this one. ${state.reason ?? ""} Your text is still here if you'd like to rework it.`.replace(
        /\s+/g,
        " ",
      );
    case "rate_limited": {
      const retry = state.retryAt ? new Date(state.retryAt) : null;
      const when =
        retry && !Number.isNaN(retry.getTime())
          ? ` You can post again at ${timeFormat.format(retry)}.`
          : " You can post again tomorrow.";
      return `You've posted ${POSTS_PER_DAY} jokes in the last 24 hours. Nice work!${when}`;
    }
  }
}

export type PostJokeFormProps = {
  /** Posts left in the rolling 24h window, or null when unknown. */
  postsLeft: number | null;
};

/**
 * The post form (US-4) with a live grapheme counter (D7). Submits through
 * `useActionState`; on success the action redirects to the new joke.
 */
export function PostJokeForm({ postsLeft }: PostJokeFormProps) {
  const [state, formAction, pending] = useActionState(createJokeAction, null);
  const [text, setText] = useState("");
  const textareaId = useId();
  const hintId = useId();
  const counterId = useId();
  const errorId = useId();

  const length = jokeLength(text);
  const status = lengthState(length);
  const invalid = status === "short" || status === "long";

  return (
    <form
      action={formAction}
      className="mt-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm sm:p-6"
    >
      <label htmlFor={textareaId} className="block text-base font-semibold">
        Your joke
      </label>
      <textarea
        id={textareaId}
        name="text"
        rows={6}
        required
        value={text}
        onChange={(event) => setText(event.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={`${hintId} ${counterId}${state ? ` ${errorId}` : ""}`}
        className={`mt-2 block w-full resize-y rounded-xl border bg-white p-3 text-lg leading-relaxed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8] ${
          invalid ? "border-[#B4400C]" : "border-black/20"
        }`}
      />
      <div className="mt-2 flex items-start justify-between gap-4 text-sm">
        <p
          id={hintId}
          aria-live="polite"
          className={invalid ? "font-medium text-[#B4400C]" : "text-black/70"}
        >
          {lengthHint(status)}
        </p>
        <p
          id={counterId}
          className={`shrink-0 tabular-nums ${
            invalid ? "font-medium text-[#B4400C]" : "text-black/70"
          }`}
        >
          {length} / {JOKE_MAX_LENGTH}
        </p>
      </div>

      {state && (
        <p
          id={errorId}
          role="alert"
          className="mt-4 rounded-xl border border-[#B4400C]/30 bg-[#FDF0EA] p-3 text-sm text-[#7A2B08]"
        >
          {serverErrorMessage(state)}
          {state.error === "duplicate" && state.duplicateOf && (
            <>
              {" "}
              <a
                href={`/joke/${encodeURIComponent(state.duplicateOf)}`}
                className="font-semibold underline"
              >
                See the original
              </a>
            </>
          )}
        </p>
      )}

      <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-black/70">
        <li>
          Keep it friendly. Jokes that target people or groups are removed.
        </li>
        <li>Post your own jokes, not copies from elsewhere.</li>
        <li>Any language is welcome.</li>
        <li>You can delete a joke later, but you can&apos;t edit it.</li>
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={status !== "ok" || pending}
          className={`${primaryButton} min-h-12 px-6 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {pending ? "Posting…" : "Post joke"}
        </button>
        {postsLeft !== null && (
          <p className="text-sm text-black/70">
            {postsLeft} of {POSTS_PER_DAY} posts left today
          </p>
        )}
      </div>
    </form>
  );
}

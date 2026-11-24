"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";

import { quietButton } from "@/components/buttonStyles";
import { SignInButton } from "@/components/SignInButton";
import { reportJokeAction, type ReportFormState } from "@/server/admin/actions";
import type { SignInOptions } from "@/server/auth/types";

const REASONS = ["Offensive", "Spam", "Plagiarized", "Other"] as const;

const dangerButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#15161A] px-4 font-semibold text-white hover:bg-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8] disabled:opacity-60";

const FlagIcon = () => (
  <svg
    aria-hidden="true"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 22V4m0 0h12l-2 4 2 4H4" />
  </svg>
);

export type ReportButtonProps = {
  jokeId: string;
  /** visitor: sign-in dialog; member: report dialog; reported: done. */
  state: "visitor" | "member" | "reported";
  signInOptions: SignInOptions;
};

/**
 * "Report this joke" (US-15). Members pick a reason in a native modal
 * dialog (StrictMode-safe: no cleanup that calls close()).
 */
export function ReportButton({
  jokeId,
  state,
  signInOptions,
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(state === "reported");
  const openerRef = useRef<HTMLButtonElement>(null);

  if (state === "visitor") {
    return (
      <SignInButton
        action="report"
        options={signInOptions}
        className={`${quietButton} gap-2 text-sm`}
      >
        <FlagIcon />
        Report this joke
      </SignInButton>
    );
  }

  if (done) {
    return (
      <p role="status" className="text-sm text-black/60">
        Thanks. We&apos;ve received your report.
      </p>
    );
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={`${quietButton} gap-2 text-sm`}
      >
        <FlagIcon />
        Report this joke
      </button>
      {open && (
        <ReportDialog
          jokeId={jokeId}
          onReported={() => {
            setOpen(false);
            setDone(true);
          }}
          onClose={() => {
            setOpen(false);
            openerRef.current?.focus();
          }}
        />
      )}
    </>
  );
}

function errorMessage(state: ReportFormState): string {
  if (!state || state.ok) return "";
  switch (state.error) {
    case "already_reported":
      return "You've already reported this joke.";
    case "rate_limited":
      return "You've sent a lot of reports today. Please try again tomorrow.";
    case "not_signed_in":
      return "Your session ended. Sign in again to report.";
    case "own_joke":
      return "You can't report your own joke.";
    case "not_found":
      return "This joke isn't available any more.";
    default:
      return "Pick a reason first.";
  }
}

function ReportDialog({
  jokeId,
  onReported,
  onClose,
}: {
  jokeId: string;
  onReported: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [state, formAction, pending] = useActionState(reportJokeAction, null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  useEffect(() => {
    if (state?.ok) onReported();
  }, [state, onReported]);

  const error = errorMessage(state);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl bg-white p-6 text-[#15161A] shadow-xl backdrop:bg-black/40"
    >
      <form action={formAction}>
        <input type="hidden" name="jokeId" value={jokeId} />
        <fieldset>
          <legend id={titleId} className="text-xl font-semibold tracking-tight">
            Why are you reporting this joke?
          </legend>
          <div className="mt-4 flex flex-col gap-1">
            {REASONS.map((reason) => (
              <label
                key={reason}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 hover:bg-black/5"
              >
                <input
                  type="radio"
                  name="reason"
                  value={reason}
                  required
                  className="size-4 accent-[#2B4FD8]"
                />
                {reason}
              </label>
            ))}
          </div>
        </fieldset>
        <p className="mt-3 text-sm text-black/60">
          Reports are anonymous. A joke reported by 5 people is hidden until a
          moderator reviews it.
        </p>
        <p role="alert" className="mt-2 min-h-5 text-sm text-[#B4400C]">
          {error}
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            className={quietButton}
          >
            Cancel
          </button>
          <button type="submit" disabled={pending} className={dangerButton}>
            {pending ? "Sending…" : "Send report"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

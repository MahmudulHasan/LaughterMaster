"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { deleteJokeAction } from "@/app/joke/actions";

import { secondaryButton } from "./buttonStyles";

// Own class list (not quietButton + override): two Tailwind text colours on
// one element resolve by stylesheet order, not by class order.
const deleteTrigger =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 font-semibold text-[#B4400C] hover:bg-[#FDEDE6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]";

const dangerButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#B4400C] px-4 font-semibold text-white hover:bg-[#963508] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8] disabled:opacity-60";

function ConfirmDeleteDialog({
  jokeId,
  redirectTo,
  onDeleted,
  onClose,
}: {
  jokeId: string;
  redirectTo?: string;
  onDeleted?: (jokeId: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // No cleanup that calls close(): see SignInDialog (StrictMode re-runs).
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteJokeAction(jokeId);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      if (redirectTo) {
        router.replace(redirectTo);
        return;
      }
      // Client-held lists drop the joke themselves; the refresh updates
      // server-rendered parts such as the profile's joke count.
      onDeleted?.(jokeId);
      router.refresh();
    });
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl bg-white p-6 text-[#15161A] shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-xl font-semibold tracking-tight">
        Delete this joke?
      </h2>
      <p className="mt-2 text-sm text-black/70">
        It disappears everywhere, including the top 10, and its votes stop
        counting. You can&apos;t undo this.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl border border-[#F0B49A] bg-[#FDEDE6] px-3 py-2 text-sm"
        >
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className={secondaryButton}
          disabled={pending}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          className={dangerButton}
          disabled={pending}
        >
          {pending ? "Deleting…" : "Delete joke"}
        </button>
      </div>
    </dialog>
  );
}

/**
 * The author's Delete control with a confirmation step (US-5). Render it
 * only for the joke's author; the server checks ownership again.
 * With `redirectTo` it navigates away after deleting (the joke page);
 * without, it refreshes in place, and `onDeleted` lets a client-side list
 * (LazyJokeList) remove the joke it is holding.
 */
export function DeleteJokeButton({
  jokeId,
  redirectTo,
  onDeleted,
}: {
  jokeId: string;
  redirectTo?: string;
  onDeleted?: (jokeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-label="Delete this joke"
        onClick={() => setOpen(true)}
        className={deleteTrigger}
      >
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
          <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
        </svg>
        Delete
      </button>
      {open && (
        <ConfirmDeleteDialog
          jokeId={jokeId}
          redirectTo={redirectTo}
          onDeleted={onDeleted}
          onClose={() => {
            setOpen(false);
            buttonRef.current?.focus();
          }}
        />
      )}
    </>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { quietButton, secondaryButton } from "@/components/buttonStyles";
import { deleteJokeAction } from "@/server/jokes/actions";

const dangerButton =
  "inline-flex min-h-11 items-center justify-center rounded-xl bg-[#B4400C] px-4 font-semibold text-white hover:bg-[#963508] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8] disabled:opacity-60";

/**
 * Delete with a confirmation step: the author's own joke (US-5), or any joke
 * for an admin (US-16). The confirmation is a native modal `<dialog>`
 * mounted only while open, like SignInDialog.
 */
export function DeleteJokeButton({
  jokeId,
  asAdmin = false,
}: {
  jokeId: string;
  /** An admin removing someone else's joke: different wording. */
  asAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    openerRef.current?.focus();
  }

  return (
    <>
      <button
        ref={openerRef}
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={secondaryButton}
      >
        {asAdmin ? "Delete (admin)" : "Delete"}
      </button>
      {open && (
        <ConfirmDeleteDialog
          jokeId={jokeId}
          asAdmin={asAdmin}
          onClose={close}
        />
      )}
    </>
  );
}

function ConfirmDeleteDialog({
  jokeId,
  asAdmin,
  onClose,
}: {
  jokeId: string;
  asAdmin: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  // No cleanup that calls close(): StrictMode re-runs effects, and close()
  // fires "close", which would unmount the dialog straight away.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClose={onClose}
      className="m-auto w-[min(26rem,calc(100%-2rem))] rounded-2xl bg-white p-6 text-[#15161A] shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-xl font-semibold tracking-tight">
        {asAdmin ? "Delete this member's joke?" : "Delete this joke?"}
      </h2>
      <p id={bodyId} className="mt-2 text-sm text-black/70">
        {asAdmin
          ? "You're deleting it as an admin. It disappears everywhere, including the top 10 and the author's profile, and its votes stop counting."
          : "It disappears everywhere, including the top 10, and its votes stop counting. This can't be undone."}
      </p>
      <form action={deleteJokeAction} className="mt-5 flex justify-end gap-2">
        <input type="hidden" name="jokeId" value={jokeId} />
        <button
          type="button"
          onClick={() => ref.current?.close()}
          className={quietButton}
          autoFocus
        >
          Cancel
        </button>
        <ConfirmButton />
      </form>
    </dialog>
  );
}

function ConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={dangerButton}>
      {pending ? "Deleting…" : "Delete joke"}
    </button>
  );
}

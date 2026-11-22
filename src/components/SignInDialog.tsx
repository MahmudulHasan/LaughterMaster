"use client";

import { useEffect, useId, useRef } from "react";

import { signInAsDevUser, signInWithGoogle } from "@/server/auth/actions";
import type { SignInOptions } from "@/server/auth/types";

import { primaryButton, quietButton, secondaryButton } from "./buttonStyles";

/** The action that needs an account; it picks the dialog title (US-2). */
export type SignInActionKind =
  "signin" | "post" | "like" | "dislike" | "report";

export const SIGN_IN_TITLES: Record<SignInActionKind, string> = {
  signin: "Sign in to LaughterMaster",
  post: "Sign in to post a joke",
  like: "Sign in to like jokes",
  dislike: "Sign in to dislike jokes",
  report: "Sign in to report jokes",
};

export type SignInDialogProps = {
  action: SignInActionKind;
  options: SignInOptions;
  /** Path (plus query) to return to after signing in. */
  redirectTo: string;
  /** Called once the dialog has closed (Not now, Escape, or form submit). */
  onClose: () => void;
};

/**
 * A native modal `<dialog>`: `showModal()` moves focus inside, traps it, and
 * closes on Escape. Mount it only while it should be open; the opener is
 * responsible for returning focus (see SignInButton).
 */
export function SignInDialog({
  action,
  options,
  redirectTo,
  onClose,
}: SignInDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const devHeadingId = useId();

  // No cleanup that calls close(): React's dev StrictMode re-runs effects, and
  // close() fires the `close` event, which would call onClose and unmount the
  // dialog immediately. Unmounting an open dialog removes it from the top
  // layer on its own, so no cleanup is needed.
  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const hasDevUsers = options.devUsers.length > 0;
  const configured = options.google || hasDevUsers;

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(28rem,calc(100%-2rem))] rounded-2xl bg-white p-6 text-[#15161A] shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="text-xl font-semibold tracking-tight">
        {SIGN_IN_TITLES[action]}
      </h2>
      <p className="mt-2 text-sm text-black/70">
        Reading jokes is free for everyone. To like, dislike or post, sign in
        with your Google account.
      </p>

      <div className="mt-5 flex flex-col gap-3">
        {options.google && (
          <form action={signInWithGoogle}>
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button type="submit" className={`${primaryButton} w-full`}>
              Continue with Google
            </button>
          </form>
        )}

        {hasDevUsers && (
          <section
            aria-labelledby={devHeadingId}
            className="rounded-xl border border-dashed border-amber-500 bg-amber-50 p-3"
          >
            <h3
              id={devHeadingId}
              className="text-xs font-semibold tracking-wide text-amber-800 uppercase"
            >
              Development only
            </h3>
            <p className="mt-1 text-xs text-amber-900/80">
              Test users for local development. Not available in production.
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {options.devUsers.map((user) => (
                <li key={user.id}>
                  <form action={signInAsDevUser}>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="redirectTo" value={redirectTo} />
                    <button
                      type="submit"
                      className={`${secondaryButton} w-full`}
                    >
                      Sign in as {user.name}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!configured && (
          <p role="note" className="rounded-xl bg-black/5 p-3 text-sm">
            Sign-in isn&apos;t configured yet. You can keep reading jokes.
          </p>
        )}

        <button
          type="button"
          onClick={() => ref.current?.close()}
          className={`${quietButton} w-full`}
        >
          Not now
        </button>
      </div>

      <p className="mt-4 text-xs text-black/60">
        We only show your name and profile photo. Your email is never public.
      </p>
    </dialog>
  );
}

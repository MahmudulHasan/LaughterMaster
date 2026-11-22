"use client";

import { usePathname } from "next/navigation";
import { useRef, useState, type ReactNode } from "react";

import type { SignInOptions } from "@/server/auth/types";

import { SignInDialog, type SignInActionKind } from "./SignInDialog";

export type SignInButtonProps = {
  /** Which action needs an account; picks the dialog title. */
  action: SignInActionKind;
  options: SignInOptions;
  children: ReactNode;
  className?: string;
  /** Accessible label when the visible content isn't enough (e.g. icon buttons). */
  "aria-label"?: string;
  /** Overrides the return path; defaults to the current path + query. */
  redirectTo?: string;
};

/**
 * A button that opens the sign-in dialog. Reuse it for any control that
 * needs an account (Post a joke, Like, Dislike, Report) when logged out.
 *
 * The return path is read from `window.location` at click time rather than
 * `useSearchParams()`, so this works on prerendered pages without its own
 * Suspense boundary.
 */
export function SignInButton({
  action,
  options,
  children,
  className,
  redirectTo,
  "aria-label": ariaLabel,
}: SignInButtonProps) {
  const pathname = usePathname();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [openFor, setOpenFor] = useState<string | null>(null);

  function open() {
    setOpenFor(
      redirectTo ?? `${pathname || "/"}${window.location.search ?? ""}`,
    );
  }

  function close() {
    setOpenFor(null);
    buttonRef.current?.focus();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        onClick={open}
        className={className}
      >
        {children}
      </button>
      {openFor !== null && (
        <SignInDialog
          action={action}
          options={options}
          redirectTo={openFor}
          onClose={close}
        />
      )}
    </>
  );
}

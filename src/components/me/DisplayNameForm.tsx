"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId } from "react";

import { primaryButton } from "@/components/buttonStyles";
import {
  updateDisplayNameAction,
  type DisplayNameFormState,
} from "@/server/profile/actions";

function message(state: DisplayNameFormState): string {
  if (!state) return "";
  if (state.ok) return `Saved. You're now ${state.name}.`;
  switch (state.error) {
    case "too_short":
      return "Names need at least 2 characters.";
    case "too_long":
      return "Names can be at most 30 characters.";
    case "invalid_characters":
      return "Use letters, numbers, spaces, _ or - only.";
    case "rejected":
      return state.reason || "Please choose a different name.";
    case "try_later":
      return "We couldn't check that name right now. Your old name is kept; please try again later.";
    case "not_signed_in":
      return "Your session ended. Sign in again to change your name.";
  }
}

/**
 * Change your display name (US-3). Checked by Claude on the server; on
 * success the page refreshes so the header and lists show the new name.
 */
export function DisplayNameForm({ currentName }: { currentName: string }) {
  const [state, formAction, pending] = useActionState(
    updateDisplayNameAction,
    null,
  );
  const router = useRouter();
  const inputId = useId();
  const helpId = useId();

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const text = message(state);
  const failed = state !== null && !state.ok;

  return (
    <form
      id="name"
      action={formAction}
      className="mb-8 scroll-mt-32 rounded-2xl border border-[#E3E5EA] bg-white p-5"
    >
      <label htmlFor={inputId} className="block font-semibold">
        Display name
      </label>
      <p id={helpId} className="mt-1 text-sm text-black/60">
        2–30 characters: letters (any language), numbers, spaces, _ or -. Shown
        on your jokes and profile.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          id={inputId}
          name="name"
          defaultValue={currentName}
          required
          minLength={2}
          maxLength={30}
          aria-describedby={`${helpId}${text ? ` ${inputId}-status` : ""}`}
          aria-invalid={failed || undefined}
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-black/20 px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
        />
        <button type="submit" disabled={pending} className={primaryButton}>
          {pending ? "Checking…" : "Save name"}
        </button>
      </div>
      <p
        id={`${inputId}-status`}
        role={failed ? "alert" : "status"}
        className={`mt-2 min-h-5 text-sm ${failed ? "text-[#B4400C]" : "text-[#1F6B45]"}`}
      >
        {text}
      </p>
    </form>
  );
}

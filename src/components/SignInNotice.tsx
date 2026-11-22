"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  SIGNIN_FAILED_PARAM,
  SIGNIN_FAILED_VALUE,
} from "@/server/auth/safe-redirect";

/**
 * Shows "Sign-in didn't finish. Try again." after a cancelled or failed
 * sign-in (US-1). Uses `useSearchParams`, so it must render inside <Suspense>;
 * it lives in SiteHeader, which the layout already wraps.
 */
export function SignInNotice() {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  if (params.get(SIGNIN_FAILED_PARAM) !== SIGNIN_FAILED_VALUE) return null;

  function dismiss() {
    const next = new URLSearchParams(params.toString());
    next.delete(SIGNIN_FAILED_PARAM);
    const query = next.toString();
    router.replace(`${pathname || "/"}${query ? `?${query}` : ""}`, {
      scroll: false,
    });
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50">
      <div
        role="status"
        className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 text-sm"
      >
        <p>Sign-in didn&apos;t finish. Try again.</p>
        <button
          type="button"
          onClick={dismiss}
          className="inline-flex min-h-11 items-center rounded-xl px-3 font-medium hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

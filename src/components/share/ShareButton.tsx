"use client";

import { useEffect, useState } from "react";

const base =
  "inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#2B4FD8] hover:bg-[#2B4FD8]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]";

function ShareIcon() {
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
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}

/**
 * Share a joke (SPEC US-17): the device's share sheet where available
 * (phones), otherwise copy the link and say "Link copied". The shared link
 * shows the preview card from /joke/<id>/opengraph-image.
 */
export function ShareButton({
  jokeId,
  text,
}: {
  jokeId: string;
  /** Joke text for the share sheet's message. */
  text: string;
}) {
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  async function share() {
    const url = new URL(
      `/joke/${encodeURIComponent(jokeId)}`,
      window.location.origin,
    ).toString();
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: "LaughterMaster", text, url });
        return;
      } catch (error) {
        // The person closed the share sheet: nothing to do.
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        // Otherwise fall back to copying the link.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Link copied");
    } catch {
      setStatus("Couldn't copy the link");
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={share} className={base}>
        <ShareIcon />
        Share
      </button>
      <span role="status" className="text-sm text-[#1F6B45]">
        {status}
      </span>
    </span>
  );
}

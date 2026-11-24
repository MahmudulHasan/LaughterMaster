"use client";

import { useEffect, useId, useRef, useState } from "react";

const base =
  "inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-[#2B4FD8] hover:bg-[#2B4FD8]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]";

const item =
  "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-medium text-[#15161A] hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]";

/** Longest joke text put into a WhatsApp or X message, in graphemes. */
const MESSAGE_MAX_GRAPHEMES = 200;

function shorten(text: string, max = MESSAGE_MAX_GRAPHEMES): string {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  const parts = Array.from(segmenter.segment(text.trim()), (s) => s.segment);
  if (parts.length <= max) return parts.join("");
  return `${parts.slice(0, max - 1).join("")}…`;
}

/**
 * Share links for a joke page. Facebook takes only the URL and builds the
 * preview from the page's Open Graph tags; WhatsApp and X also carry the
 * joke text, shortened so the message stays readable.
 */
export function shareLinks(url: string, text: string) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(shorten(text));
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    whatsapp: `https://wa.me/?text=${t}%20${u}`,
    x: `https://x.com/intent/post?text=${t}&url=${u}`,
  };
}

function Icon({ d }: { d: string }) {
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
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
  facebook: "M15 3h-2a4 4 0 0 0-4 4v3H7v4h2v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h2z",
  whatsapp:
    "M3 21l1.7-5A8.5 8.5 0 1 1 8 19.3zM9 9.5c0 3 2.5 5.5 5.5 5.5l1.5-1.5-2-1-1 1c-1-.5-2-1.5-2.5-2.5l1-1-1-2z",
  x: "M4 4l16 16M20 4L4 20",
  link: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1",
  more: "M5 12h.01M12 12h.01M19 12h.01",
};

/**
 * Share a joke (SPEC US-17): a small menu with Facebook, WhatsApp, X and
 * Copy link, which work on every device, plus the device's own share sheet
 * ("More options…") where the browser has one. Shared links show the preview
 * card from /joke/<id>/opengraph-image.
 */
export function ShareButton({
  jokeId,
  text,
}: {
  jokeId: string;
  /** Joke text for the share message. */
  text: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  // Browser-only facts, read when the menu opens (an event, never during
  // render) so server and client render the same closed button.
  const [target, setTarget] = useState({ url: "", canNativeShare: false });
  const rootRef = useRef<HTMLSpanElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  function toggle() {
    if (!open) {
      setTarget({
        url: new URL(
          `/joke/${encodeURIComponent(jokeId)}`,
          window.location.origin,
        ).toString(),
        canNativeShare: typeof navigator.share === "function",
      });
    }
    setOpen(!open);
  }

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), 3000);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function copyLink() {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(target.url);
      setStatus("Link copied");
    } catch {
      setStatus("Couldn't copy the link");
    }
  }

  async function nativeShare() {
    setOpen(false);
    try {
      await navigator.share({ title: "LaughterMaster", text, url: target.url });
    } catch {
      // Closed by the person, or the sheet failed: the menu is still there.
    }
  }

  const links = shareLinks(target.url, text);

  return (
    <span ref={rootRef} className="relative inline-flex items-center gap-2">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={toggle}
        className={base}
      >
        <Icon d={ICONS.share} />
        Share
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Share this joke"
          className="absolute bottom-full left-0 z-40 mb-2 w-56 rounded-xl border border-black/10 bg-white p-1.5 shadow-lg"
        >
          <a
            role="menuitem"
            href={links.facebook}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={item}
          >
            <Icon d={ICONS.facebook} />
            Share on Facebook
          </a>
          <a
            role="menuitem"
            href={links.whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={item}
          >
            <Icon d={ICONS.whatsapp} />
            Share on WhatsApp
          </a>
          <a
            role="menuitem"
            href={links.x}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className={item}
          >
            <Icon d={ICONS.x} />
            Share on X
          </a>
          <button
            type="button"
            role="menuitem"
            onClick={copyLink}
            className={item}
          >
            <Icon d={ICONS.link} />
            Copy link
          </button>
          {target.canNativeShare && (
            <button
              type="button"
              role="menuitem"
              onClick={nativeShare}
              className={item}
            >
              <Icon d={ICONS.more} />
              More options…
            </button>
          )}
        </div>
      )}
      <span role="status" className="text-sm text-[#1F6B45]">
        {status}
      </span>
    </span>
  );
}

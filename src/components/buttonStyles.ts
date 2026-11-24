// Shared Tailwind classes so every button keeps the 44px touch target and
// the same visible focus ring (WCAG 2.1 AA, SPEC §5).
const base =
  "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2B4FD8]";

export const primaryButton = `${base} bg-[#2B4FD8] text-white hover:bg-[#2442b8]`;
export const secondaryButton = `${base} border border-black/15 bg-white text-[#15161A] hover:bg-black/5`;
export const quietButton = `${base} font-medium text-black/70 hover:bg-black/5`;

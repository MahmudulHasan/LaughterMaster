/** Dark pill with a sparkle marking JokeBot's daily AI joke (US-12). */
export function AiBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#15161A] px-2.5 py-0.5 text-xs font-semibold text-white">
      <svg
        aria-hidden="true"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d="M12 2l2.2 6.6L21 11l-6.8 2.4L12 20l-2.2-6.6L3 11l6.8-2.4z" />
      </svg>
      AI joke
    </span>
  );
}

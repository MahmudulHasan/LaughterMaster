const MAX_WORDS = 6;
const MAX_CHARS = 48;

/**
 * Browser tab title for `/joke/<id>` (US-6): the joke's first few words, so
 * tabs and bookmarks are tellable apart. `null` gives the generic title.
 */
export function jokeTitle(text: string | null): string {
  const suffix = " · LaughterMaster";
  if (!text) return `Joke${suffix}`;
  const words = text.trim().split(/\s+/);
  let start = words.slice(0, MAX_WORDS).join(" ");
  let cut = words.length > MAX_WORDS;
  if (start.length > MAX_CHARS) {
    start = start.slice(0, MAX_CHARS).trimEnd();
    cut = true;
  }
  if (cut) start = `${start.replace(/[\s.,;:!?…-]+$/, "")}…`;
  return `“${start}”${suffix}`;
}

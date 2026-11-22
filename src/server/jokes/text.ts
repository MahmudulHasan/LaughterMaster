// Joke text rules (US-4, D7). Pure functions with no server imports, so the
// post form can use the same counter and limits as the server.

import { z } from "zod";

export const JOKE_MIN_LENGTH = 10;
export const JOKE_MAX_LENGTH = 500;
/** D8: posts per member in any rolling 24 hours. */
export const POSTS_PER_DAY = 10;

export const TOO_SHORT_MESSAGE = `A bit short. Jokes need at least ${JOKE_MIN_LENGTH} characters.`;
export const TOO_LONG_MESSAGE = `Too long. Trim it to ${JOKE_MAX_LENGTH} characters or fewer.`;

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * Characters as people see them (Unicode grapheme clusters), so an emoji
 * family or a Bengali conjunct counts as one, not as several code units.
 */
export function countGraphemes(text: string): number {
  let count = 0;
  const segments = segmenter.segment(text)[Symbol.iterator]();
  while (!segments.next().done) count++;
  return count;
}

const jokeTextSchema = z
  .string()
  .trim()
  .refine((text) => countGraphemes(text) >= JOKE_MIN_LENGTH, TOO_SHORT_MESSAGE)
  .refine((text) => countGraphemes(text) <= JOKE_MAX_LENGTH, TOO_LONG_MESSAGE);

export type JokeTextResult =
  { ok: true; text: string } | { ok: false; message: string };

/** Trim, then check the 10–500 grapheme rule. */
export function validateJokeText(input: unknown): JokeTextResult {
  const parsed = jokeTextSchema.safeParse(input);
  if (parsed.success) return { ok: true, text: parsed.data };
  // Non-strings fail with zod's own message; show our short-text one instead.
  const issue = parsed.error.issues[0];
  const message = issue?.code === "custom" ? issue.message : TOO_SHORT_MESSAGE;
  return { ok: false, message };
}

/**
 * The comparison form used for exact-duplicate checks (M5): compatibility
 * forms folded (NFKC), lowercased, whitespace collapsed.
 */
export function normalizeJokeText(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

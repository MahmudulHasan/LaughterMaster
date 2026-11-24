// Text layout for the 1200×630 share card (SPEC US-17). Pure, so it's easy
// to test: the image route just renders what these return.

/** Longest joke text shown on the card, in graphemes, before "…". */
export const CARD_MAX_GRAPHEMES = 180;

function graphemes(text: string): string[] {
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  return Array.from(segmenter.segment(text), (s) => s.segment);
}

/**
 * The joke text for the card: whitespace tidied (line breaks kept), cut at a
 * word boundary near the limit, with "…" when shortened. Counts graphemes so
 * emoji and non-Latin scripts aren't split.
 */
export function cardText(text: string, max = CARD_MAX_GRAPHEMES): string {
  const tidy = text
    .trim()
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n");
  const parts = graphemes(tidy);
  if (parts.length <= max) return tidy;
  let cut = parts.slice(0, max).join("");
  const lastSpace = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf("\n"));
  if (lastSpace > max * 0.6) cut = cut.slice(0, lastSpace);
  return `${cut.replace(/[\s.,;:!?…-]+$/u, "")}…`;
}

/** Bigger type for short jokes, smaller for long ones, so it always fits. */
export function cardFontSize(text: string): number {
  const length = graphemes(text).length;
  if (length <= 60) return 64;
  if (length <= 110) return 52;
  return 42;
}

/**
 * Whether the card can show this text faithfully. The image renderer has
 * no complex-script shaping (Bangla, Hindi, Arabic, ...) and only a Latin
 * font, so anything beyond Latin letters, accents, digits, punctuation and
 * emoji gets a generic card instead of garbled text.
 */
export function canRenderOnCard(text: string): boolean {
  return !/[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(
    text,
  );
}

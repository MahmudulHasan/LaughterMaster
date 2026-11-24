import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { Font } from "harfbuzzjs";

// Bangla text for the share card (SPEC US-17, D18). The card renderer
// (next/og) places letters side by side and can't shape scripts like Bangla,
// where letters join into conjuncts and vowel signs move around consonants.
// So we shape the text with HarfBuzz (the engine browsers use), turn the
// glyphs into SVG outlines, and hand the card a finished picture of the text.

const FONT_DIR = join(process.cwd(), "assets/fonts");

export type FontName = "bengali" | "latin";

export interface CardShaper {
  fonts: Record<FontName, Font>;
  /** Whether a font has a glyph for a code point. */
  has: Record<FontName, (codePoint: number) => boolean>;
}

// harfbuzzjs is an ES module with top-level await; keep the loaded module so
// layout stays synchronous after loadCardShaper().
let hbCache: typeof import("harfbuzzjs") | null = null;

let shaperPromise: Promise<CardShaper> | null = null;

/**
 * Load HarfBuzz and the two bold card fonts once per process: Noto Sans
 * Bengali (no Latin letters) and Noto Sans for English, digits and
 * punctuation. Both are 1000 units per em.
 */
export function loadCardShaper(): Promise<CardShaper> {
  shaperPromise ??= (async () => {
    // Loaded on first use only: Latin-only cards never pay for the WASM.
    const hb = await import("harfbuzzjs");
    hbCache = hb;
    const open = async (file: string) => {
      const face = new hb.Face(
        new hb.Blob(await readFile(join(FONT_DIR, file))),
      );
      return new hb.Font(face);
    };
    const [bengali, latin] = await Promise.all([
      open("noto-sans-bengali-700.ttf"),
      open("noto-sans-latin-700.ttf"),
    ]);
    const hasGlyph = (font: Font) => (cp: number) =>
      Boolean(font.nominalGlyph(cp));
    return {
      fonts: { bengali, latin },
      has: { bengali: hasGlyph(bengali), latin: hasGlyph(latin) },
    };
  })().catch((error: unknown) => {
    shaperPromise = null;
    throw error;
  });
  return shaperPromise;
}

const BENGALI = /\p{Script=Bengali}/u;
const MARK = /[\p{M}‌‍]/u;

/**
 * Whether the card can draw this text with its fonts: Bangla, Latin,
 * digits, punctuation and symbols. Emoji are allowed but left out.
 */
export function canShapeOnCard(text: string): boolean {
  return !/[^\p{Script=Bengali}\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}]/u.test(
    text,
  );
}

export interface Run {
  font: FontName;
  text: string;
}

/**
 * Split text into runs for each font. Bangla letters use the Bangla font;
 * marks and joiners stay with the letter before them; anything else stays in
 * the current font if it has the glyph (so the danda stays with Bangla), and
 * otherwise goes to whichever font has it. Characters neither font has, such
 * as emoji, are dropped.
 */
export function splitRuns(
  text: string,
  hasBengali: (cp: number) => boolean,
  hasLatin: (cp: number) => boolean,
): Run[] {
  const has: Record<FontName, (cp: number) => boolean> = {
    bengali: hasBengali,
    latin: hasLatin,
  };
  const runs: Run[] = [];
  let current: FontName | null = null;
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    let font: FontName | null;
    if (BENGALI.test(char)) font = hasBengali(cp) ? "bengali" : null;
    else if (MARK.test(char) && current) font = current;
    else if (current && has[current](cp)) font = current;
    else if (hasLatin(cp)) font = "latin";
    else if (hasBengali(cp)) font = "bengali";
    else font = null;
    if (!font) continue;
    const last = runs.at(-1);
    if (last && last.font === font) last.text += char;
    else runs.push({ font, text: char });
    current = font;
  }
  return runs;
}

const round = (n: number) => String(Math.round(n * 10) / 10);

/**
 * Move a HarfBuzz glyph outline (font units, y up) to the card: scale it,
 * flip y, and offset it to (ox, oy) in pixels.
 */
export function transformPath(
  d: string,
  scale: number,
  ox: number,
  oy: number,
): string {
  return d.replace(
    /(-?\d*\.?\d+(?:e-?\d+)?),(-?\d*\.?\d+(?:e-?\d+)?)/g,
    (_m, x, y) =>
      `${round(ox + Number(x) * scale)},${round(oy - Number(y) * scale)}`,
  );
}

interface Glyph {
  font: Font;
  id: number;
  /** Pen position plus offsets, in font units from the word's start. */
  x: number;
  y: number;
}

interface Word {
  glyphs: Glyph[];
  width: number;
}

function shapeWord(
  hbModule: typeof import("harfbuzzjs"),
  shaper: CardShaper,
  word: string,
): Word {
  const glyphs: Glyph[] = [];
  let pen = 0;
  for (const run of splitRuns(word, shaper.has.bengali, shaper.has.latin)) {
    const font = shaper.fonts[run.font];
    const buffer = new hbModule.Buffer();
    buffer.addText(run.text);
    buffer.guessSegmentProperties();
    hbModule.shape(font, buffer);
    for (const g of buffer.getGlyphInfosAndPositions()) {
      glyphs.push({
        font,
        id: g.codepoint,
        x: pen + (g.xOffset ?? 0),
        y: g.yOffset ?? 0,
      });
      pen += g.xAdvance ?? 0;
    }
  }
  return { glyphs, width: pen };
}

export interface ShapedText {
  /** SVG path data for the whole text block, origin at its top left. */
  d: string;
  width: number;
  height: number;
  fontSize: number;
  lines: number;
  truncated: boolean;
  /** Glyph ids drawn, in order (for tests and debugging). */
  glyphIds: number[];
}

export interface LayoutBox {
  maxWidth: number;
  maxHeight: number;
  /** Font sizes to try, largest first. */
  sizes?: number[];
  maxLines?: number;
  /** Line spacing and the room above/below a line, in ems. */
  metrics?: LineMetrics;
}

export interface LineMetrics {
  lineHeight: number;
  ascent: number;
  descent: number;
}

/** Room for Bangla vowel signs above and below the letters. */
export const BANGLA_METRICS: LineMetrics = {
  lineHeight: 1.45,
  ascent: 1.1,
  descent: 0.45,
};

/** Matches the card's Latin text style (line-height 1.25). */
export const LATIN_METRICS: LineMetrics = {
  lineHeight: 1.25,
  ascent: 0.95,
  descent: 0.3,
};

/** Sizes tried for the joke, largest first: short jokes stay big, long
 * ones shrink until the whole joke fits (500 characters fit at 26–29px). */
export const CARD_SIZES = [64, 52, 44, 38, 33, 29, 26];

const UNITS_PER_EM = 1000;

/**
 * Shape `text`, wrap it into the box at the largest size that fits
 * (CARD_SIZES by default), keep the author's line breaks, and cut it with
 * "…" only when even the smallest size can't fit it.
 */
export function layoutShapedText(
  shaper: CardShaper,
  text: string,
  box: LayoutBox,
): ShapedText {
  if (!hbCache) throw new Error("Call loadCardShaper() before layout");
  const hbModule = hbCache;
  const sizes = box.sizes ?? CARD_SIZES;
  const m = box.metrics ?? BANGLA_METRICS;
  const blockHeight = (lines: number, size: number) =>
    (lines - 1) * size * m.lineHeight + size * (m.ascent + m.descent);
  const shape = (word: string) => shapeWord(hbModule, shaper, word);
  const space = shape(" ").width;
  const ellipsis = shape("…");

  const paragraphs = text
    .trim()
    .split("\n")
    .map((p) =>
      p
        .split(/[ \t]+/)
        .filter(Boolean)
        .map(shape),
    );

  const lineWidth = (words: Word[]) =>
    words.reduce((sum, w) => sum + w.width, 0) +
    space * Math.max(0, words.length - 1);

  function wrap(maxUnits: number): Word[][] {
    const lines: Word[][] = [];
    for (const words of paragraphs) {
      let line: Word[] = [];
      for (const word of words) {
        if (line.length && lineWidth([...line, word]) > maxUnits) {
          lines.push(line);
          line = [];
        }
        line.push(word);
      }
      lines.push(line);
    }
    return lines;
  }

  let size = sizes[sizes.length - 1];
  let lines: Word[][] = [];
  let truncated = false;
  for (const candidate of sizes) {
    const maxUnits = (box.maxWidth / candidate) * UNITS_PER_EM;
    const wrapped = wrap(maxUnits);
    const fits =
      blockHeight(wrapped.length, candidate) <= box.maxHeight &&
      wrapped.length <= (box.maxLines ?? Infinity) &&
      wrapped.every((l) => lineWidth(l) <= maxUnits);
    size = candidate;
    lines = wrapped;
    if (fits) break;
  }

  const maxUnits = (box.maxWidth / size) * UNITS_PER_EM;
  let maxLines = box.maxLines ?? Infinity;
  while (
    maxLines > 1 &&
    blockHeight(Math.min(maxLines, lines.length), size) > box.maxHeight
  )
    maxLines = Math.min(maxLines, lines.length) - 1;
  if (lines.length > maxLines || lines.some((l) => lineWidth(l) > maxUnits)) {
    truncated = true;
    lines = lines.slice(0, maxLines);
    const last = lines[lines.length - 1] ?? [];
    while (last.length > 1 && lineWidth([...last, ellipsis]) > maxUnits)
      last.pop();
    last.push(ellipsis);
  }

  const scale = size / UNITS_PER_EM;
  const parts: string[] = [];
  const glyphIds: number[] = [];
  let widest = 0;
  lines.forEach((line, i) => {
    const baseline = i * size * m.lineHeight + size * m.ascent;
    let pen = 0;
    line.forEach((word, w) => {
      if (w > 0) pen += space;
      for (const g of word.glyphs) {
        const outline = g.font.glyphToPath(g.id);
        glyphIds.push(g.id);
        if (outline)
          parts.push(
            transformPath(
              outline,
              scale,
              (pen + g.x) * scale,
              baseline - g.y * scale,
            ),
          );
      }
      pen += word.width;
    });
    widest = Math.max(widest, pen * scale);
  });

  return {
    d: parts.join(""),
    width: Math.min(box.maxWidth, Math.ceil(widest)),
    height: Math.ceil(blockHeight(lines.length, size)),
    fontSize: size,
    lines: lines.length,
    truncated,
    glyphIds,
  };
}

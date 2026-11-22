import { describe, expect, it } from "vitest";

import {
  JOKE_MAX_LENGTH,
  JOKE_MIN_LENGTH,
  countGraphemes,
  normalizeJokeText,
  validateJokeText,
} from "./text";

describe("countGraphemes", () => {
  it.each([
    ["hello", 5],
    ["👨‍👩‍👧", 1],
    ["🇧🇩🇯🇵", 2],
    ["é", 1], // e + combining accent
    ["হাসি", 2], // Bengali: 4 code points, 2 grapheme clusters
    ["日本語", 3],
  ])("counts %j as %i characters", (text, expected) => {
    expect(countGraphemes(text)).toBe(expected);
  });
});

describe("validateJokeText", () => {
  it("trims before counting and returns the trimmed text", () => {
    const result = validateJokeText("   Ten chars!   ");
    expect(result).toEqual({ ok: true, text: "Ten chars!" });
  });

  it(`rejects text under ${JOKE_MIN_LENGTH} characters after trimming`, () => {
    const result = validateJokeText("  123456789     ");
    expect(result).toEqual({
      ok: false,
      message: "A bit short. Jokes need at least 10 characters.",
    });
  });

  it("rejects empty or whitespace-only text", () => {
    expect(validateJokeText("   \n ").ok).toBe(false);
  });

  it(`accepts exactly ${JOKE_MIN_LENGTH} and ${JOKE_MAX_LENGTH} characters`, () => {
    expect(validateJokeText("a".repeat(10)).ok).toBe(true);
    expect(validateJokeText("a".repeat(500)).ok).toBe(true);
  });

  it(`rejects more than ${JOKE_MAX_LENGTH} characters`, () => {
    expect(validateJokeText("a".repeat(501))).toEqual({
      ok: false,
      message: "Too long. Trim it to 500 characters or fewer.",
    });
  });

  it("counts emoji as one character each, so 500 family emoji fit", () => {
    expect(validateJokeText("👨‍👩‍👧".repeat(500)).ok).toBe(true);
    expect(validateJokeText("👨‍👩‍👧".repeat(9)).ok).toBe(false);
  });

  it("accepts any language", () => {
    expect(validateJokeText("ছাত্র: স্যার, আমি কি পাস করেছি?").ok).toBe(true);
    expect(
      validateJokeText("なぜ猫はパソコンが好きなの？マウスがあるから").ok,
    ).toBe(true);
  });

  it("rejects non-string input", () => {
    expect(validateJokeText(undefined).ok).toBe(false);
    expect(validateJokeText(42).ok).toBe(false);
  });
});

describe("normalizeJokeText", () => {
  it("lowercases, applies NFKC and collapses whitespace", () => {
    expect(normalizeJokeText("  Why   did\nthe ＣＨＩＣＫＥＮ  ")).toBe(
      "why did the chicken",
    );
  });
});

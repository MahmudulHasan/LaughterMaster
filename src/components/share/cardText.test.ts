// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  CARD_MAX_GRAPHEMES,
  canRenderOnCard,
  cardFontSize,
  cardText,
} from "./cardText";

describe("cardText (US-17)", () => {
  it("keeps short jokes, tidying spaces but keeping line breaks", () => {
    expect(cardText("  Knock   knock.\nWho's there?  ")).toBe(
      "Knock knock.\nWho's there?",
    );
  });

  it("keeps a whole joke of the maximum length", () => {
    const full = "word ".repeat(100).trim(); // 499 characters
    expect(cardText(full)).toBe(full);
  });

  it("truncates text past the limit at a word boundary with an ellipsis", () => {
    const long = "word ".repeat(150);
    const card = cardText(long);
    expect(card.endsWith("…")).toBe(true);
    expect(Array.from(card).length).toBeLessThanOrEqual(CARD_MAX_GRAPHEMES + 1);
    expect(card).not.toMatch(/\s…$/);
  });

  it("never splits an emoji or a Bangla grapheme", () => {
    const emoji = "😂".repeat(200);
    const card = cardText(emoji, 10);
    expect(card).toBe(`${"😂".repeat(10)}…`);
    const bangla = "রোগী ".repeat(80);
    expect(cardText(bangla, 30).endsWith("…")).toBe(true);
  });

  it("uses smaller type for longer jokes", () => {
    expect(cardFontSize("Short joke.")).toBeGreaterThan(
      cardFontSize("x ".repeat(80)),
    );
  });
});

describe("canRenderOnCard", () => {
  it("allows Latin text with accents, digits, punctuation and emoji", () => {
    expect(canRenderOnCard("¿Qué? 10 jalapeños… 😂 “quotes”")).toBe(true);
  });

  it("rejects scripts the renderer can't shape or has no font for", () => {
    for (const text of [
      "রোগী: জি",
      "होमवर्क कहाँ है",
      "컴퓨터는 바다에",
      "مرحبا",
    ]) {
      expect(canRenderOnCard(text)).toBe(false);
    }
  });
});

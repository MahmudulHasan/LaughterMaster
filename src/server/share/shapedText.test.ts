// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

import {
  canShapeOnCard,
  layoutShapedText,
  loadCardShaper,
  splitRuns,
  transformPath,
  type CardShaper,
} from "./shapedText";

let shaper: CardShaper;

beforeAll(async () => {
  shaper = await loadCardShaper();
});

describe("canShapeOnCard", () => {
  it("accepts Bangla, alone or mixed with English, digits and punctuation", () => {
    expect(canShapeOnCard("ডাক্তার বাবু, ওষুধটা কোথায়?")).toBe(true);
    expect(canShapeOnCard("Doctor বললেন: 2টা খাবেন।")).toBe(true);
  });

  it("rejects scripts the card has no font for", () => {
    expect(canShapeOnCard("नमस्ते दुनिया")).toBe(false); // Hindi
    expect(canShapeOnCard("مرحبا")).toBe(false); // Arabic
    expect(canShapeOnCard("Bangla আর 中文")).toBe(false);
  });
});

describe("splitRuns", () => {
  const bengali = (cp: number) =>
    (cp >= 0x0980 && cp <= 0x09ff) || cp === 0x20 || cp === 0x0964;
  const latin = (cp: number) => cp < 0x0250;

  it("keeps Bangla in the Bangla font and English in the Latin font", () => {
    expect(splitRuns("Doctor বলল", bengali, latin)).toEqual([
      { font: "latin", text: "Doctor " },
      { font: "bengali", text: "বলল" },
    ]);
  });

  it("keeps the danda with Bangla and a comma with the font that has it", () => {
    expect(splitRuns("হ্যাঁ, না।", bengali, latin)).toEqual([
      { font: "bengali", text: "হ্যাঁ" },
      { font: "latin", text: ", " },
      { font: "bengali", text: "না।" },
    ]);
  });

  it("drops characters neither font has, such as emoji", () => {
    expect(splitRuns("হাসি 😀", bengali, latin)).toEqual([
      { font: "bengali", text: "হাসি " },
    ]);
  });
});

describe("transformPath", () => {
  it("scales font units, flips y, and moves the glyph into place", () => {
    expect(transformPath("M10,20L30,-40Q1,2 3,4Z", 0.5, 100, 200)).toBe(
      "M105,190L115,220Q100.5,199 101.5,198Z",
    );
  });
});

describe("layoutShapedText", () => {
  const box = { maxWidth: 1056, maxHeight: 380 };

  it("shapes conjuncts instead of drawing letters side by side", () => {
    // Unshaped, ক্ত is ক + a visible virama (্) + ত. Shaped, the virama
    // disappears into the conjunct form.
    const virama = shaper.fonts.bengali.nominalGlyph(0x09cd);
    const shaped = layoutShapedText(shaper, "ক্ত", box);
    expect(virama).toBeTruthy();
    expect(shaped.glyphIds).not.toContain(virama);
    expect(shaped.d).toMatch(/^M/);
  });

  it("uses big type for a short joke and keeps it inside the box", () => {
    const shaped = layoutShapedText(shaper, "আমার ডায়েট খুব ভালো চলছে।", box);
    expect(shaped.fontSize).toBe(64);
    expect(shaped.lines).toBe(1);
    expect(shaped.width).toBeLessThanOrEqual(box.maxWidth);
    expect(shaped.height).toBeLessThanOrEqual(box.maxHeight);
  });

  it("wraps a long joke onto several lines, smaller, still inside the box", () => {
    const text =
      "রোগী – ডাক্তার বাবু, প্রেসক্রিপশনে একদম উপরে যে ওষুধটা লিখেছেন সেটা কোথাও পাওয়া যাচ্ছে না। ডাক্তার – ওটা ওষুধ না, ওটা আমার কলমটা চলছে কিনা দেখছিলাম।";
    const shaped = layoutShapedText(shaper, text, box);
    expect(shaped.lines).toBeGreaterThan(1);
    expect(shaped.fontSize).toBeLessThan(64);
    expect(shaped.width).toBeLessThanOrEqual(box.maxWidth);
    expect(shaped.height).toBeLessThanOrEqual(box.maxHeight);
    expect(shaped.truncated).toBe(false);
  });

  it("keeps line breaks the author typed", () => {
    const shaped = layoutShapedText(shaper, "প্রশ্ন?\nউত্তর!", box);
    expect(shaped.lines).toBe(2);
  });

  it("cuts a joke that can't fit and ends it with …", () => {
    const text = Array.from({ length: 60 }, () => "অনেক লম্বা কথা").join(" ");
    const shaped = layoutShapedText(shaper, text, box);
    expect(shaped.truncated).toBe(true);
    expect(shaped.height).toBeLessThanOrEqual(box.maxHeight);
    expect(shaped.width).toBeLessThanOrEqual(box.maxWidth);
  });

  it("fits a single line at a fixed size for the author name", () => {
    const shaped = layoutShapedText(shaper, "A joke by রহিম উদ্দিন", {
      maxWidth: 600,
      maxHeight: 40,
      sizes: [26],
      maxLines: 1,
    });
    expect(shaped.fontSize).toBe(26);
    expect(shaped.lines).toBe(1);
  });
});

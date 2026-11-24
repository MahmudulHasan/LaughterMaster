import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";
import { connection } from "next/server";

import {
  canRenderOnCard,
  cardFontSize,
  cardText,
} from "@/components/share/cardText";
import { getReadyDb } from "@/server/db/ready";
import { getJokeForViewer } from "@/server/jokes/queries";
import {
  canShapeOnCard,
  LATIN_METRICS,
  layoutShapedText,
  loadCardShaper,
  type ShapedText,
} from "@/server/share/shapedText";

// The share card for /joke/<id> (SPEC US-17). Next links it automatically as
// og:image; X/Twitter fall back to og:image with summary_large_image.
export const alt = "A joke on LaughterMaster";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const FONT_DIR = join(process.cwd(), "assets/fonts");
const FONT_FILES = [
  ["noto-sans-latin-400-normal.woff", 400],
  ["noto-sans-latin-700-normal.woff", 700],
] as const;

let fontsPromise: Promise<
  { name: string; data: Buffer; weight: 400 | 700; style: "normal" }[]
> | null = null;

// Latin text goes through the renderer with these fonts. Bangla can't (the
// renderer doesn't shape it), so it is shaped with HarfBuzz and drawn as
// outlines (shapedText.ts). Other scripts get a generic card (D18).
function loadFonts() {
  fontsPromise ??= Promise.all(
    FONT_FILES.map(async ([file, weight]) => ({
      name: "Noto Sans",
      data: await readFile(join(FONT_DIR, file)),
      weight,
      style: "normal" as const,
    })),
  );
  return fontsPromise;
}

function Smile() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="#FFD23F" strokeWidth="2" />
      <path
        d="M8 14s1.5 2 4 2 4-2 4-2"
        stroke="#FFD23F"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M9 9h.01M15 9h.01"
        stroke="#FFD23F"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Shaped text as an SVG the renderer draws like a picture. */
function ShapedSvg({ shaped }: { shaped: ShapedText }) {
  return (
    <svg
      width={shaped.width}
      height={shaped.height}
      viewBox={`0 0 ${shaped.width} ${shaped.height}`}
    >
      <path d={shaped.d} fill="#15161A" />
    </svg>
  );
}

const textStyle = {
  display: "flex",
  fontWeight: 700,
  lineHeight: 1.25,
  whiteSpace: "pre-wrap",
} as const;

/** The joke area between the logo row and the byline, in pixels. */
const TEXT_WIDTH = 1056;
const TEXT_HEIGHT = 400;

/**
 * Type size for Latin text, which the renderer wraps itself. Short jokes use
 * fixed sizes; longer ones are measured with HarfBuzz and the same Noto Sans
 * font so the whole joke fits (with a little width to spare for differences
 * in where the renderer breaks lines).
 */
async function latinFontSize(text: string): Promise<number> {
  if (Array.from(text).length <= 110) return cardFontSize(text);
  const fit = layoutShapedText(await loadCardShaper(), text, {
    maxWidth: TEXT_WIDTH * 0.95,
    maxHeight: TEXT_HEIGHT,
    metrics: LATIN_METRICS,
  });
  return fit.fontSize;
}

/** The joke area: plain text for Latin, shaped outlines for Bangla. */
async function JokeBody({ text }: { text: string | null }) {
  if (text === null)
    return (
      <div style={{ ...textStyle, fontSize: 64 }}>
        Post jokes, vote, and laugh.
      </div>
    );
  if (canRenderOnCard(text)) {
    const shown = cardText(text);
    return (
      <div style={{ ...textStyle, fontSize: await latinFontSize(shown) }}>
        {shown}
      </div>
    );
  }
  if (canShapeOnCard(text)) {
    const shaped = layoutShapedText(await loadCardShaper(), cardText(text), {
      maxWidth: TEXT_WIDTH,
      maxHeight: TEXT_HEIGHT,
    });
    return <ShapedSvg shaped={shaped} />;
  }
  return (
    <div style={{ ...textStyle, fontSize: 64 }}>
      Open the link to read this joke.
    </div>
  );
}

/** "A joke by <name>", shaped when the name is in Bangla. */
async function Byline({ author }: { author: string | null }) {
  if (!author) return <div style={{ display: "flex" }}> </div>;
  const line = `A joke by ${author}`;
  if (canRenderOnCard(author))
    return <div style={{ display: "flex", fontWeight: 700 }}>{line}</div>;
  if (canShapeOnCard(author)) {
    const shaped = layoutShapedText(await loadCardShaper(), line, {
      maxWidth: 640,
      maxHeight: 40,
      sizes: [26],
      maxLines: 1,
    });
    return <ShapedSvg shaped={shaped} />;
  }
  return <div style={{ display: "flex" }}> </div>;
}

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Reads the database per request (cacheComponents would try to prerender).
  await connection();
  const { id } = await params;
  const joke = await getJokeForViewer(await getReadyDb(), id, null);
  const [body, byline] = await Promise.all([
    JokeBody({ text: joke?.text ?? null }),
    Byline({ author: joke?.author.displayName ?? null }),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        background: "#FFD23F",
        color: "#15161A",
        fontFamily: "Noto Sans",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "#15161A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Smile />
        </div>
        <div style={{ fontSize: 34, fontWeight: 700 }}>LaughterMaster</div>
      </div>
      {body}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 26,
        }}
      >
        {byline}
        <div style={{ display: "flex" }}>Read it on LaughterMaster</div>
      </div>
    </div>,
    { ...size, fonts: await loadFonts() },
  );
}

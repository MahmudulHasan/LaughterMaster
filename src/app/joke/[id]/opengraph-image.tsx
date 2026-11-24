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

// Latin only: jokes in other scripts get a generic card (canRenderOnCard),
// because the renderer can't shape Bangla, Hindi, Arabic and similar.
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

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // Reads the database per request (cacheComponents would try to prerender).
  await connection();
  const { id } = await params;
  const joke = await getJokeForViewer(await getReadyDb(), id, null);
  const text = !joke
    ? "Post jokes, vote, and laugh."
    : canRenderOnCard(joke.text)
      ? cardText(joke.text)
      : "Open the link to read this joke.";
  const author = joke?.author.displayName ?? null;

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
      <div
        style={{
          display: "flex",
          fontSize: cardFontSize(text),
          fontWeight: 700,
          lineHeight: 1.25,
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 26,
        }}
      >
        <div style={{ display: "flex", fontWeight: 700 }}>
          {author && canRenderOnCard(author) ? `A joke by ${author}` : " "}
        </div>
        <div style={{ display: "flex" }}>Read it on LaughterMaster</div>
      </div>
    </div>,
    { ...size, fonts: await loadFonts() },
  );
}

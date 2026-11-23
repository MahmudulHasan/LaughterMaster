import { NextResponse, type NextRequest } from "next/server";

import { getReadyDb } from "@/server/db/ready";
import { listJokes } from "@/server/jokes/queries";
import type { JokePage } from "@/server/jokes/types";

import { NO_STORE, readCursor } from "./cursorParam";

/** GET /api/jokes?cursor= — the next batch of approved jokes (US-7). */
export async function GET(request: NextRequest) {
  const parsed = readCursor(request.nextUrl);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "invalid_cursor" },
      { status: 400, headers: NO_STORE },
    );
  }
  const db = await getReadyDb();
  const page: JokePage = await listJokes(db, { cursor: parsed.cursor });
  return NextResponse.json(page, { headers: NO_STORE });
}

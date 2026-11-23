import { connection, NextResponse, type NextRequest } from "next/server";

import { auth } from "@/auth";
import { getReadyDb } from "@/server/db/ready";
import { listJokes } from "@/server/jokes/queries";
import type { JokePage } from "@/server/jokes/types";
import { withMyVotes } from "@/server/jokes/votes";

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
  const listed = await listJokes(db, { cursor: parsed.cursor });
  // See CLAUDE.md: auth() must come after connection() with cacheComponents.
  await connection();
  const session = await auth();
  const page: JokePage = {
    ...listed,
    jokes: await withMyVotes(db, session?.user?.id ?? null, listed.jokes),
  };
  return NextResponse.json(page, { headers: NO_STORE });
}

import { connection, NextResponse, type NextRequest } from "next/server";

import { NO_STORE, readCursor } from "@/app/api/jokes/cursorParam";
import { auth } from "@/auth";
import { getReadyDb } from "@/server/db/ready";
import { getProfile, listUserJokes } from "@/server/jokes/queries";
import type { JokePage } from "@/server/jokes/types";
import { withMyVotes } from "@/server/jokes/votes";

/**
 * GET /api/users/<id>/jokes?cursor= — the next batch of a member's jokes
 * (US-18). The owner also gets their pending jokes; unknown or banned → 404.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = readCursor(request.nextUrl);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: "invalid_cursor" },
      { status: 400, headers: NO_STORE },
    );
  }

  const db = await getReadyDb();
  const profile = await getProfile(db, id);
  if (!profile) {
    return NextResponse.json(
      { error: "not_found" },
      { status: 404, headers: NO_STORE },
    );
  }

  // See CLAUDE.md: auth() must come after connection() with cacheComponents.
  await connection();
  const session = await auth();
  const viewerId = session?.user?.id ?? null;
  const listed = await listUserJokes(db, {
    userId: id,
    viewerId,
    cursor: parsed.cursor,
  });
  const page: JokePage = {
    ...listed,
    jokes: await withMyVotes(db, viewerId, listed.jokes),
  };
  return NextResponse.json(page, { headers: NO_STORE });
}

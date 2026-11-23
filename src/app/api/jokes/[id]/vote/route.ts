import { connection, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { NO_STORE } from "@/app/api/jokes/cursorParam";
import { auth } from "@/auth";
import { getReadyDb } from "@/server/db/ready";
import type { VoteError } from "@/server/jokes/types";
import { castVote } from "@/server/jokes/votes";

const bodySchema = z.object({ value: z.union([z.literal(1), z.literal(-1)]) });

const STATUS: Record<VoteError, number> = {
  not_signed_in: 401,
  own_joke: 403,
  not_found: 404,
};

/**
 * POST /api/jokes/<id>/vote with `{ "value": 1 | -1 }` (US-8). Clicking the
 * button that matches your current vote removes it; the other one switches
 * it. Responds `{ myVote }` with the viewer's vote afterwards. The voter is
 * always the session user, never a value from the request.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || id.length > 200) {
    return NextResponse.json(
      { error: "bad_request" },
      { status: 400, headers: NO_STORE },
    );
  }

  // See CLAUDE.md: auth() must come after connection() with cacheComponents.
  await connection();
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "not_signed_in" },
      { status: 401, headers: NO_STORE },
    );
  }

  const db = await getReadyDb();
  const result = await castVote(db, {
    jokeId: id,
    userId,
    value: parsed.data.value,
  });
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: STATUS[result.error], headers: NO_STORE },
    );
  }
  return NextResponse.json({ myVote: result.myVote }, { headers: NO_STORE });
}

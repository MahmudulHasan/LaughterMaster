import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { toJokeListItem, type JokeListPage } from "@/lib/joke-list-item";
import { getAppDb } from "@/server/db/app-db";
import { listPublicJokes } from "@/server/jokes/list";

const querySchema = z.object({
  cursor: z.string().min(1).max(100).optional(),
  author: z.string().min(1).max(100).optional(),
});

/**
 * GET /api/jokes?cursor=<id>&author=<userId>: the next batch of public
 * jokes, newest first (US-7, US-18). Public, no sign-in needed.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    cursor: params.get("cursor") ?? undefined,
    author: params.get("author") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query" }, { status: 400 });
  }

  const page = await listPublicJokes(await getAppDb(), {
    cursor: parsed.data.cursor,
    authorId: parsed.data.author,
  });
  if (!page) {
    return NextResponse.json({ error: "Unknown cursor" }, { status: 400 });
  }

  const body: JokeListPage = {
    jokes: page.jokes.map(toJokeListItem),
    nextCursor: page.nextCursor,
  };
  // Lists change as jokes are posted and deleted; never cache a batch.
  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}

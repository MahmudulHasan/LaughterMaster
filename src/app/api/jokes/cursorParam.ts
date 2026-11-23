import { decodeCursor } from "@/server/jokes/cursor";

/**
 * Reads `?cursor=`. Missing or empty means the first page; an undecodable
 * cursor is a client error (agreed with the data owner: queries would return
 * an empty page, which would wrongly look like the end of the list).
 */
export function readCursor(
  url: URL,
): { ok: true; cursor: string | null } | { ok: false } {
  const cursor = url.searchParams.get("cursor");
  if (!cursor) return { ok: true, cursor: null };
  return decodeCursor(cursor) ? { ok: true, cursor } : { ok: false };
}

export const NO_STORE = { "Cache-Control": "private, no-store" };

// Opaque keyset cursors for joke lists (SPEC US-7, D12).
//
// A cursor names the last joke a client has seen as (createdAt, id). The next
// batch is every visible joke strictly older in (createdAt desc, id desc)
// order, so jokes posted while someone scrolls never shift the list and cause
// duplicates or gaps the way offsets would.
//
// `createdAt` is Postgres's own UTC text with microseconds, not a JS Date:
// timestamps from `now()` carry microseconds, and rounding them to
// milliseconds would make the comparison skip or repeat rows.

export type CursorKey = {
  /** UTC timestamp with microseconds, e.g. 2026-11-22T10:00:00.123456Z. */
  createdAt: string;
  id: string;
};

const TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const MAX_ID_LENGTH = 200;

function isCursorKey(value: unknown): value is CursorKey {
  if (typeof value !== "object" || value === null) return false;
  const { createdAt, id } = value as Record<string, unknown>;
  return (
    typeof createdAt === "string" &&
    TIMESTAMP_RE.test(createdAt) &&
    !Number.isNaN(Date.parse(createdAt)) &&
    typeof id === "string" &&
    id.length > 0 &&
    id.length <= MAX_ID_LENGTH
  );
}

export function encodeCursor(key: CursorKey): string {
  return Buffer.from(
    JSON.stringify({ createdAt: key.createdAt, id: key.id }),
    "utf8",
  ).toString("base64url");
}

/** The key inside a cursor, or null if the cursor is malformed. */
export function decodeCursor(cursor: string): CursorKey | null {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor) || cursor.length > 1000) return null;
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8"),
    );
    return isCursorKey(parsed)
      ? { createdAt: parsed.createdAt, id: parsed.id }
      : null;
  } catch {
    return null;
  }
}

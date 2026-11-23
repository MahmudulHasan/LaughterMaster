// @vitest-environment node
import { describe, expect, it } from "vitest";

import { decodeCursor, encodeCursor } from "./cursor";

describe("joke cursors", () => {
  const key = { createdAt: "2026-11-22T10:00:00.123456Z", id: "abc-123" };

  it("round-trips a key as an opaque url-safe string", () => {
    const cursor = encodeCursor(key);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodeCursor(cursor)).toEqual(key);
  });

  it.each([
    "",
    "not a cursor!",
    "%%%",
    Buffer.from("not json").toString("base64url"),
    Buffer.from("[1,2]").toString("base64url"),
    Buffer.from(JSON.stringify({ createdAt: "yesterday", id: "x" })).toString(
      "base64url",
    ),
    Buffer.from(
      JSON.stringify({ createdAt: "2026-13-45T99:00:00.000000Z", id: "x" }),
    ).toString("base64url"),
    Buffer.from(JSON.stringify({ createdAt: key.createdAt, id: "" })).toString(
      "base64url",
    ),
    Buffer.from(JSON.stringify({ createdAt: key.createdAt, id: 5 })).toString(
      "base64url",
    ),
  ])("returns null for garbage %#", (cursor) => {
    expect(decodeCursor(cursor)).toBeNull();
  });
});

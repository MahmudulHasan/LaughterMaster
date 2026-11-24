// @vitest-environment node
import { eq, sql, type SQL } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb, type Db } from "../db/client";
import { runMigrations } from "../db/migrate";
import { jokes, users } from "../db/schema";
import { encodeCursor } from "./cursor";
import {
  countRecentPosts,
  createJoke,
  deleteJoke,
  getJokeForViewer,
  getProfile,
  listJokes,
  listUserJokes,
  normalizeJokeText,
  removeJokeAsAdmin,
} from "./queries";
import type { JokePage, JokeStatus } from "./types";

const HOUR = 60 * 60 * 1000;
const T0 = new Date("2026-11-22T12:00:00.000Z");
const at = (hours: number) => new Date(T0.getTime() + hours * HOUR);

let db: Db;

async function addUser(id: string, isBanned = false) {
  await db.insert(users).values({
    id,
    provider: "dev",
    providerAccountId: id,
    displayName: `Name ${id}`,
    avatarUrl: `https://example.com/${id}.png`,
    email: `${id}@example.com`,
    isBanned,
  });
}

let seq = 0;
/** Insert a joke directly, bypassing createJoke's checks. */
async function addJoke(
  authorId: string,
  opts: {
    status?: JokeStatus;
    createdAt?: Date | SQL;
    id?: string;
    isBot?: boolean;
  } = {},
) {
  const id = opts.id ?? `joke-${String(++seq).padStart(4, "0")}`;
  await db.insert(jokes).values({
    id,
    authorId,
    text: `Joke ${id} is funny`,
    normalizedText: `joke ${id} is funny`,
    status: opts.status ?? "approved",
    isBot: opts.isBot ?? false,
    ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
  });
  return id;
}

/** Follow nextCursor to the end, optionally doing something between pages. */
async function collectAll(
  fetchPage: (cursor: string | null) => Promise<JokePage>,
  between?: (pageIndex: number) => Promise<void>,
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  for (let i = 0; i < 100; i++) {
    const page = await fetchPage(cursor);
    ids.push(...page.jokes.map((j) => j.id));
    if (!page.nextCursor) return ids;
    cursor = page.nextCursor;
    await between?.(i);
  }
  throw new Error("pagination did not terminate");
}

beforeEach(async () => {
  db = createDb({ inMemory: true });
  await runMigrations(db);
  await addUser("mina");
  await addUser("priya");
  await addUser("banned", true);
});

afterEach(async () => {
  await db.$client.close();
});

describe("normalizeJokeText", () => {
  it("lowercases, strips punctuation and collapses whitespace", () => {
    expect(normalizeJokeText("  Why did   the CHICKEN...\n cross?!  ")).toBe(
      "why did the chicken cross",
    );
    expect(normalizeJokeText("Don't")).toBe("dont");
    expect(normalizeJokeText("नमस्ते,   दुनिया!")).toBe("नमस्ते दुनिया");
  });
});

describe("createJoke", () => {
  // Regression: a session that outlived its member row crashed the post page
  // with a foreign-key error instead of asking the member to sign in again.
  it("treats a missing or banned author as signed out", async () => {
    const text = "A perfectly reasonable joke about cheese.";
    for (const authorId of ["ghost", "banned"]) {
      expect(await createJoke(db, { authorId, text, now: T0 })).toEqual({
        ok: false,
        error: "not_signed_in",
      });
    }
    const [{ count }] = (
      await db.execute(sql`select count(*)::int as count from jokes`)
    ).rows as [{ count: number }];
    expect(count).toBe(0);
  });

  it("trims, saves and returns a pending joke without email", async () => {
    const result = await createJoke(db, {
      authorId: "mina",
      text: "   Why did the chicken cross the road?  ",
      now: T0,
    });
    expect(result).toEqual({
      ok: true,
      joke: {
        id: expect.any(String),
        text: "Why did the chicken cross the road?",
        status: "pending",
        author: {
          id: "mina",
          displayName: "Name mina",
          avatarUrl: "https://example.com/mina.png",
        },
        createdAt: T0.toISOString(),
        isBot: false,
        category: null,
      },
    });
    expect(JSON.stringify(result)).not.toContain("@example.com");
    const [row] = await db.select().from(jokes);
    expect(row?.normalizedText).toBe("why did the chicken cross the road");
  });

  it("rejects fewer than 10 characters after trimming", async () => {
    expect(
      await createJoke(db, { authorId: "mina", text: "   123456789     " }),
    ).toEqual({ ok: false, error: "too_short" });
    expect(await db.select().from(jokes)).toHaveLength(0);
  });

  it("accepts exactly 10 and 500 characters, rejects 501", async () => {
    expect(
      (await createJoke(db, { authorId: "mina", text: "a".repeat(10) })).ok,
    ).toBe(true);
    expect(
      (await createJoke(db, { authorId: "mina", text: "a".repeat(500) })).ok,
    ).toBe(true);
    expect(
      await createJoke(db, { authorId: "mina", text: "a".repeat(501) }),
    ).toEqual({ ok: false, error: "too_long" });
  });

  it("counts graphemes, so emoji and non-Latin scripts count fairly", async () => {
    // 10 family emoji: 10 graphemes but far more UTF-16 code units.
    const family = "👨‍👩‍👧‍👦".repeat(10);
    expect(family.length).toBeGreaterThan(10);
    expect((await createJoke(db, { authorId: "mina", text: family })).ok).toBe(
      true,
    );
    expect(
      await createJoke(db, { authorId: "mina", text: "👨‍👩‍👧‍👦".repeat(501) }),
    ).toEqual({ ok: false, error: "too_long" });
    // "नमस्ते" is 6 code points but 3 graphemes.
    expect(
      await createJoke(db, { authorId: "mina", text: "नमस्ते नमस्ते" }),
    ).toEqual({ ok: false, error: "too_short" });
    // Korean syllables: 10 graphemes.
    expect(
      (await createJoke(db, { authorId: "mina", text: "안녕하세요안녕하세요" }))
        .ok,
    ).toBe(true);
    // Decomposed Hangul jamo (30 code points) still form 10 graphemes.
    expect(
      (
        await createJoke(db, {
          authorId: "priya",
          text: "안녕하세요안녕하세요".normalize("NFD"),
        })
      ).ok,
    ).toBe(true);
    expect(
      await createJoke(db, { authorId: "priya", text: "안녕하세요안녕하세" }),
    ).toEqual({ ok: false, error: "too_short" });
  });

  it("allows 10 posts per rolling 24h, then reports when to retry", async () => {
    for (let i = 0; i < 10; i++) {
      const r = await createJoke(db, {
        authorId: "mina",
        text: `Joke number ${i} here`,
        now: at(i),
      });
      expect(r.ok).toBe(true);
    }
    expect(await countRecentPosts(db, "mina", at(10))).toBe(10);
    expect(
      await createJoke(db, {
        authorId: "mina",
        text: "One joke too many",
        now: at(10),
      }),
    ).toEqual({
      ok: false,
      error: "rate_limited",
      retryAt: at(24).toISOString(),
    });
    // Others are unaffected.
    expect(
      (
        await createJoke(db, {
          authorId: "priya",
          text: "Priya's joke!",
          now: at(10),
        })
      ).ok,
    ).toBe(true);
    // Once the oldest joke is 24h old, one more fits.
    expect(
      (
        await createJoke(db, {
          authorId: "mina",
          text: "Back again now",
          now: at(24),
        })
      ).ok,
    ).toBe(true);
    expect(
      await createJoke(db, {
        authorId: "mina",
        text: "And once more",
        now: at(24.5),
      }),
    ).toEqual({
      ok: false,
      error: "rate_limited",
      retryAt: at(25).toISOString(),
    });
  });

  it("counts every joke posted in 24h, whatever its status", async () => {
    const statuses: JokeStatus[] = [
      "pending",
      "rejected",
      "hidden",
      "removed",
      "deleted",
    ];
    for (let i = 0; i < 10; i++)
      await addJoke("mina", {
        createdAt: at(i),
        status: statuses[i] ?? "approved",
      });
    // An older joke is outside the window.
    await addJoke("mina", { createdAt: at(-14.5) });
    expect(await countRecentPosts(db, "mina", at(10))).toBe(10);
    expect(
      await createJoke(db, {
        authorId: "mina",
        text: "Blocked for now",
        now: at(10),
      }),
    ).toEqual({
      ok: false,
      error: "rate_limited",
      retryAt: at(24).toISOString(),
    });
  });

  it("blocks delete-then-repost at the limit", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await createJoke(db, {
        authorId: "mina",
        text: `Joke number ${i} here`,
        now: at(i),
      });
      if (!r.ok) throw new Error("expected the post to succeed");
      ids.push(r.joke.id);
    }
    for (const jokeId of ids.slice(5))
      expect(await deleteJoke(db, { jokeId, userId: "mina" })).toBe(true);
    // Deleting doesn't give posts back.
    expect(await countRecentPosts(db, "mina", at(10))).toBe(10);
    expect(
      await createJoke(db, {
        authorId: "mina",
        text: "Sneaky repost attempt",
        now: at(10),
      }),
    ).toEqual({
      ok: false,
      error: "rate_limited",
      retryAt: at(24).toISOString(),
    });
    // The window still rolls forward normally.
    expect(
      (
        await createJoke(db, {
          authorId: "mina",
          text: "Back again now",
          now: at(24),
        })
      ).ok,
    ).toBe(true);
  });
});

describe("getJokeForViewer", () => {
  it("shows approved jokes to everyone, logged out included", async () => {
    const id = await addJoke("mina");
    expect((await getJokeForViewer(db, id, null))?.id).toBe(id);
    expect((await getJokeForViewer(db, id, "priya"))?.id).toBe(id);
    expect((await getJokeForViewer(db, id, "mina"))?.id).toBe(id);
  });

  it("shows pending jokes only to their author", async () => {
    const id = await addJoke("mina", { status: "pending" });
    expect((await getJokeForViewer(db, id, "mina"))?.status).toBe("pending");
    expect(await getJokeForViewer(db, id, "priya")).toBeNull();
    expect(await getJokeForViewer(db, id, null)).toBeNull();
  });

  it.each(["deleted", "hidden", "removed", "rejected"] as const)(
    "hides %s jokes from everyone, the author included",
    async (status) => {
      const id = await addJoke("mina", { status });
      expect(await getJokeForViewer(db, id, "mina")).toBeNull();
      expect(await getJokeForViewer(db, id, "priya")).toBeNull();
      expect(await getJokeForViewer(db, id, null)).toBeNull();
    },
  );

  it("returns null for unknown or malformed ids and banned authors", async () => {
    expect(await getJokeForViewer(db, "nope", null)).toBeNull();
    expect(
      await getJokeForViewer(db, "'; drop table jokes; --", null),
    ).toBeNull();
    const id = await addJoke("banned");
    expect(await getJokeForViewer(db, id, null)).toBeNull();
    expect(await getJokeForViewer(db, id, "banned")).toBeNull();
  });
});

describe("deleteJoke", () => {
  it("lets the author soft-delete their joke once", async () => {
    const id = await addJoke("mina");
    expect(await deleteJoke(db, { jokeId: id, userId: "mina" })).toBe(true);
    const [row] = await db.select().from(jokes).where(eq(jokes.id, id));
    expect(row?.status).toBe("deleted");
    expect(await getJokeForViewer(db, id, "mina")).toBeNull();
    expect((await listJokes(db)).jokes).toEqual([]);
    expect(await deleteJoke(db, { jokeId: id, userId: "mina" })).toBe(false);
  });

  it("refuses other members and unknown jokes", async () => {
    const id = await addJoke("mina");
    expect(await deleteJoke(db, { jokeId: id, userId: "priya" })).toBe(false);
    expect(await deleteJoke(db, { jokeId: "nope", userId: "mina" })).toBe(
      false,
    );
    const [row] = await db.select().from(jokes).where(eq(jokes.id, id));
    expect(row?.status).toBe("approved");
  });
});

describe("removeJokeAsAdmin (US-16)", () => {
  it("removes any member's joke, so it disappears for everyone", async () => {
    const id = await addJoke("mina");
    expect(await removeJokeAsAdmin(db, { jokeId: id })).toBe(true);
    expect(await getJokeForViewer(db, id, null)).toBeNull();
    expect(await getJokeForViewer(db, id, "mina")).toBeNull();
    const [row] = await db.select().from(jokes).where(eq(jokes.id, id));
    expect(row!.status).toBe("removed");
  });

  it("is false for unknown or already removed/deleted jokes", async () => {
    const deleted = await addJoke("mina", { status: "deleted" });
    expect(await removeJokeAsAdmin(db, { jokeId: deleted })).toBe(false);
    expect(await removeJokeAsAdmin(db, { jokeId: "nope" })).toBe(false);
    const id = await addJoke("mina");
    await removeJokeAsAdmin(db, { jokeId: id });
    expect(await removeJokeAsAdmin(db, { jokeId: id })).toBe(false);
  });
});

describe("listJokes", () => {
  it("lists only approved jokes from non-banned authors, newest first", async () => {
    const old = await addJoke("mina", { createdAt: at(-2) });
    const fresh = await addJoke("priya", { createdAt: at(-1) });
    for (const status of [
      "pending",
      "rejected",
      "hidden",
      "removed",
      "deleted",
    ] as const)
      await addJoke("mina", { status });
    await addJoke("banned");
    const page = await listJokes(db);
    expect(page.jokes.map((j) => j.id)).toEqual([fresh, old]);
    expect(page.nextCursor).toBeNull();
    expect(JSON.stringify(page)).not.toContain("@example.com");
  });

  it("includes approved JokeBot jokes with isBot set", async () => {
    await addUser("jokebot");
    const human = await addJoke("mina", { createdAt: at(-2) });
    const bot = await addJoke("jokebot", { createdAt: at(-1), isBot: true });
    await addJoke("jokebot", { status: "pending", isBot: true });
    const page = await listJokes(db);
    expect(page.jokes.map((j) => [j.id, j.isBot])).toEqual([
      [bot, true],
      [human, false],
    ]);
  });

  it("returns an empty page when there are no jokes", async () => {
    expect(await listJokes(db)).toEqual({ jokes: [], nextCursor: null });
  });

  it("pages in batches of 20 and ends without an extra empty batch", async () => {
    for (let i = 0; i < 40; i++) await addJoke("mina", { createdAt: at(-i) });
    const first = await listJokes(db);
    expect(first.jokes).toHaveLength(20);
    const second = await listJokes(db, { cursor: first.nextCursor });
    expect(second.jokes).toHaveLength(20);
    expect(second.nextCursor).toBeNull();
  });

  it("returns every joke exactly once in order, even as new jokes arrive", async () => {
    const expected: string[] = [];
    for (let i = 0; i < 45; i++)
      expected.unshift(await addJoke("mina", { createdAt: at(-45 + i) }));
    const seen = await collectAll(
      (cursor) => listJokes(db, { cursor }),
      async () => {
        // New jokes are newer than everything; they must not shift the list.
        await addJoke("priya", { createdAt: at(1) });
        await addJoke("priya");
      },
    );
    expect(seen).toEqual(expected);
  });

  it("breaks ties on identical createdAt by id, with no gaps", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 25; i++)
      ids.push(
        await addJoke("mina", {
          createdAt: T0,
          id: `tie-${String(i).padStart(2, "0")}`,
        }),
      );
    const seen = await collectAll((cursor) =>
      listJokes(db, { cursor, limit: 7 }),
    );
    expect(seen).toEqual([...ids].reverse());
  });

  it("pages correctly over sub-millisecond timestamps", async () => {
    // Timestamps from now() carry microseconds that JS Dates can't hold. All
    // of these fall in the same millisecond, and ids run opposite to time.
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) {
      const ts = `2026-11-22T12:00:00.0000${String(50 - i).padStart(2, "0")}Z`;
      ids.push(await addJoke("mina", { createdAt: sql`${ts}::timestamptz` }));
    }
    const rows = await db.execute(
      sql`select count(distinct created_at)::int as n from jokes`,
    );
    expect(rows.rows[0]).toEqual({ n: 12 });
    const seen = await collectAll((cursor) =>
      listJokes(db, { cursor, limit: 5 }),
    );
    expect(seen).toEqual(ids);
  });

  it("returns an empty last page for a malformed cursor", async () => {
    await addJoke("mina");
    for (const cursor of [
      "garbage",
      "!!!",
      Buffer.from("{}").toString("base64url"),
    ])
      expect(await listJokes(db, { cursor })).toEqual({
        jokes: [],
        nextCursor: null,
      });
    // Empty string means the first page.
    expect((await listJokes(db, { cursor: "" })).jokes).toHaveLength(1);
  });

  it("treats a well-formed cursor for an unknown joke as a position", async () => {
    const older = await addJoke("mina", { createdAt: at(-2) });
    await addJoke("mina", { createdAt: at(1) });
    const cursor = encodeCursor({
      createdAt: "2026-11-22T12:00:00.000000Z",
      id: "zzz",
    });
    expect((await listJokes(db, { cursor })).jokes.map((j) => j.id)).toEqual([
      older,
    ]);
  });

  it("clamps the page size", async () => {
    for (let i = 0; i < 3; i++) await addJoke("mina", { createdAt: at(-i) });
    expect((await listJokes(db, { limit: 0 })).jokes).toHaveLength(1);
    expect((await listJokes(db, { limit: 2 })).jokes).toHaveLength(2);
  });
});

describe("listUserJokes", () => {
  it("lists a member's approved jokes, plus pending ones only for them", async () => {
    const approved = await addJoke("mina", { createdAt: at(-3) });
    const pending = await addJoke("mina", {
      status: "pending",
      createdAt: at(-2),
    });
    await addJoke("mina", { status: "rejected", createdAt: at(-1) });
    await addJoke("mina", { status: "deleted", createdAt: at(-1) });
    await addJoke("priya");

    const ids = async (viewerId: string | null) =>
      (await listUserJokes(db, { userId: "mina", viewerId })).jokes.map(
        (j) => j.id,
      );
    expect(await ids("mina")).toEqual([pending, approved]);
    expect(await ids("priya")).toEqual([approved]);
    expect(await ids(null)).toEqual([approved]);
    expect(
      (await listUserJokes(db, { userId: "mina" })).jokes.map((j) => j.id),
    ).toEqual([approved]);
  });

  it("lists JokeBot's approved jokes on its profile", async () => {
    await addUser("jokebot");
    const older = await addJoke("jokebot", { createdAt: at(-2), isBot: true });
    const newer = await addJoke("jokebot", { createdAt: at(-1), isBot: true });
    await addJoke("jokebot", { status: "rejected", isBot: true });
    await addJoke("mina");
    const page = await listUserJokes(db, { userId: "jokebot", viewerId: null });
    expect(page.jokes.map((j) => j.id)).toEqual([newer, older]);
    expect(page.jokes.every((j) => j.isBot)).toBe(true);
  });

  it("is empty for banned and unknown members", async () => {
    await addJoke("banned");
    expect(
      await listUserJokes(db, { userId: "banned", viewerId: null }),
    ).toEqual({
      jokes: [],
      nextCursor: null,
    });
    expect(
      await listUserJokes(db, { userId: "nobody", viewerId: "nobody" }),
    ).toEqual({
      jokes: [],
      nextCursor: null,
    });
  });

  it("pages through every joke exactly once while new ones arrive", async () => {
    const expected: string[] = [];
    for (let i = 0; i < 30; i++)
      expected.unshift(await addJoke("mina", { createdAt: at(-30 + i) }));
    const seen = await collectAll(
      (cursor) => listUserJokes(db, { userId: "mina", viewerId: null, cursor }),
      async () => {
        await addJoke("mina", { createdAt: at(1) });
      },
    );
    expect(seen).toEqual(expected);
  });
});

describe("getProfile", () => {
  it("returns public data and the approved joke count", async () => {
    await addJoke("mina");
    await addJoke("mina");
    await addJoke("mina", { status: "pending" });
    await addJoke("mina", { status: "deleted" });
    const profile = await getProfile(db, "mina");
    expect(profile).toEqual({
      user: {
        id: "mina",
        displayName: "Name mina",
        avatarUrl: "https://example.com/mina.png",
      },
      joinedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      approvedJokeCount: 2,
    });
    expect(JSON.stringify(profile)).not.toContain("@example.com");
    expect((await getProfile(db, "priya"))?.approvedJokeCount).toBe(0);
  });

  it("is null for unknown or banned members", async () => {
    expect(await getProfile(db, "nobody")).toBeNull();
    expect(await getProfile(db, "banned")).toBeNull();
  });
});

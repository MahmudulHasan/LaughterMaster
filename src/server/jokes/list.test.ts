// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb, type Db } from "../db/client";
import { runMigrations } from "../db/migrate";
import { jokes, users } from "../db/schema";
import { upsertUserFromProvider } from "../users";

import { LIST_PAGE_SIZE, listPublicJokes } from "./list";

const t0 = new Date("2026-11-22T12:00:00Z");
const minutes = (n: number) => new Date(t0.getTime() + n * 60_000);

describe("listPublicJokes", () => {
  let db: Db;
  let seq = 0;

  /** Insert directly so tests control time, status and ids. */
  async function add(
    at: Date,
    opts: { status?: "approved" | "pending" | "deleted"; author?: string } = {},
  ) {
    const id = `j${String(++seq).padStart(3, "0")}`;
    await db.insert(jokes).values({
      id,
      authorId: opts.author ?? "dev-mina",
      text: `Joke ${id} is a funny one`,
      normalizedText: `joke ${id}`,
      status: opts.status ?? "approved",
      createdAt: at,
    });
    return id;
  }

  async function addMany(count: number, startMinute = 0) {
    const ids: string[] = [];
    for (let i = 0; i < count; i++)
      ids.push(await add(minutes(startMinute + i)));
    return ids;
  }

  /** Walk every page and return all ids in order. */
  async function readAll(opts: { authorId?: string } = {}) {
    const seen: string[] = [];
    let cursor: string | undefined;
    for (;;) {
      const page = (await listPublicJokes(db, { ...opts, cursor }))!;
      seen.push(...page.jokes.map((j) => j.id));
      if (!page.nextCursor) return seen;
      cursor = page.nextCursor;
    }
  }

  beforeEach(async () => {
    seq = 0;
    db = createDb({ inMemory: true });
    await runMigrations(db);
    for (const id of ["dev-mina", "dev-priya"]) {
      await upsertUserFromProvider(
        db,
        {
          provider: "dev",
          providerAccountId: id,
          name: id,
          image: null,
          email: `${id}@example.com`,
        },
        { id },
      );
    }
  });

  afterEach(async () => {
    await db.$client.close();
  });

  it("returns an empty first page and no cursor when there are no jokes", async () => {
    expect(await listPublicJokes(db, {})).toEqual({
      jokes: [],
      nextCursor: null,
    });
  });

  it(`returns ${LIST_PAGE_SIZE} newest first with a cursor, then the rest`, async () => {
    const ids = await addMany(25);
    const first = (await listPublicJokes(db, {}))!;
    expect(first.jokes.map((j) => j.id)).toEqual(
      ids.slice(5).reverse(), // 25 → 6
    );
    expect(first.nextCursor).toEqual(expect.any(String));

    const last = (await listPublicJokes(db, { cursor: first.nextCursor! }))!;
    expect(last.jokes.map((j) => j.id)).toEqual(ids.slice(0, 5).reverse());
    expect(last.nextCursor).toBeNull();
  });

  it("gives no cursor when the last page is exactly full", async () => {
    await addMany(LIST_PAGE_SIZE);
    expect((await listPublicJokes(db, {}))!.nextCursor).toBeNull();
  });

  it("has no duplicates or gaps when new jokes arrive between pages", async () => {
    const original = await addMany(45);
    const page1 = (await listPublicJokes(db, {}))!;
    // Five newer jokes are posted while the reader scrolls.
    for (let i = 0; i < 5; i++) await add(minutes(100 + i));
    const page2 = (await listPublicJokes(db, { cursor: page1.nextCursor! }))!;
    await add(minutes(200));
    const page3 = (await listPublicJokes(db, { cursor: page2.nextCursor! }))!;

    const seen = [...page1.jokes, ...page2.jokes, ...page3.jokes].map(
      (j) => j.id,
    );
    expect(seen).toEqual([...original].reverse());
    expect(new Set(seen).size).toBe(seen.length);
    expect(page3.nextCursor).toBeNull();
  });

  it("orders jokes posted at the same instant by id, without losing any", async () => {
    for (let i = 0; i < 30; i++) await add(t0);
    const all = await readAll();
    expect(all).toHaveLength(30);
    expect(all).toEqual([...all].sort().reverse());
  });

  it("keeps paging after the cursor's joke is deleted", async () => {
    await addMany(30);
    const page1 = (await listPublicJokes(db, {}))!;
    await db
      .update(jokes)
      .set({ status: "deleted" })
      .where(eq(jokes.id, page1.nextCursor!));
    const page2 = (await listPublicJokes(db, { cursor: page1.nextCursor! }))!;
    expect(page2.jokes).toHaveLength(10);
  });

  it("returns null for an unknown cursor so the API can reject it", async () => {
    await addMany(3);
    expect(await listPublicJokes(db, { cursor: "nope" })).toBeNull();
  });

  it("lists only approved jokes by members who aren't banned", async () => {
    const shown = await add(minutes(1));
    await add(minutes(2), { status: "pending" });
    await add(minutes(3), { status: "deleted" });
    await add(minutes(4), { author: "dev-priya" });
    await db
      .update(users)
      .set({ isBanned: true })
      .where(eq(users.id, "dev-priya"));
    expect(await readAll()).toEqual([shown]);
  });

  it("filters by author for profiles", async () => {
    const mine = await add(minutes(1));
    await add(minutes(2), { author: "dev-priya" });
    expect(await readAll({ authorId: "dev-mina" })).toEqual([mine]);
  });

  it("returns public fields only, never email or vote data", async () => {
    await add(minutes(1));
    const [joke] = (await listPublicJokes(db, {}))!.jokes;
    expect(Object.keys(joke!).sort()).toEqual(
      ["author", "category", "createdAt", "id", "isBot", "text"].sort(),
    );
    expect(Object.keys(joke!.author).sort()).toEqual(
      ["avatarUrl", "displayName", "id"].sort(),
    );
    expect(JSON.stringify(joke)).not.toContain("@example.com");
  });
});

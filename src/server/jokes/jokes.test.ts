// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb, type Db } from "../db/client";
import { runMigrations } from "../db/migrate";
import { jokes } from "../db/schema";
import { upsertUserFromProvider } from "../users";

import { POSTS_PER_DAY, createJoke, getPostQuota } from "./jokes";

const HOUR = 60 * 60 * 1000;
const t0 = new Date("2026-11-22T12:00:00Z");
const at = (hours: number) => new Date(t0.getTime() + hours * HOUR);

describe("jokes", () => {
  let db: Db;
  let authorId: string;

  beforeEach(async () => {
    db = createDb({ inMemory: true });
    await runMigrations(db);
    const user = await upsertUserFromProvider(
      db,
      {
        provider: "dev",
        providerAccountId: "dev-mina",
        name: "Mina",
        image: null,
        email: "mina@example.com",
      },
      { id: "dev-mina" },
    );
    authorId = user.id;
  });

  afterEach(async () => {
    await db.$client.close();
  });

  async function postMany(count: number, hoursApart = 0.1) {
    for (let i = 0; i < count; i++) {
      const result = await createJoke(db, {
        authorId,
        text: `Joke number ${i} is funny`,
        now: at(i * hoursApart),
      });
      expect(result.ok).toBe(true);
    }
  }

  it("saves a valid joke trimmed, approved (until M5) and normalized", async () => {
    const result = await createJoke(db, {
      authorId,
      text: "  Why did the   chicken cross the road?  ",
      now: t0,
    });

    expect(result).toEqual({
      ok: true,
      joke: { id: expect.any(String), status: "approved" },
      remaining: POSTS_PER_DAY - 1,
    });
    const [row] = await db.select().from(jokes);
    expect(row).toMatchObject({
      authorId,
      text: "Why did the   chicken cross the road?",
      normalizedText: "why did the chicken cross the road?",
      status: "approved",
      isBot: false,
      createdAt: t0,
    });
  });

  it("saves nothing when the text is invalid", async () => {
    const result = await createJoke(db, {
      authorId,
      text: "too short",
      now: t0,
    });
    expect(result).toEqual({
      ok: false,
      reason: "invalid",
      message: "A bit short. Jokes need at least 10 characters.",
    });
    expect(await db.select().from(jokes)).toHaveLength(0);
  });

  it(`allows ${POSTS_PER_DAY} posts in 24h, then says when the next is possible`, async () => {
    await postMany(POSTS_PER_DAY);

    const blocked = await createJoke(db, {
      authorId,
      text: "One joke too many today",
      now: at(2),
    });

    // The first post (t0) leaves the window 24h later.
    expect(blocked).toEqual({
      ok: false,
      reason: "rate_limited",
      retryAt: at(24),
    });
    expect(await db.select().from(jokes)).toHaveLength(POSTS_PER_DAY);
  });

  it("allows posting again once the oldest post is 24h old", async () => {
    await postMany(POSTS_PER_DAY);
    const justBefore = await createJoke(db, {
      authorId,
      text: "Still too soon for this",
      now: new Date(at(24).getTime() - 1),
    });
    expect(justBefore.ok).toBe(false);

    const onTime = await createJoke(db, {
      authorId,
      text: "Right on time for this",
      now: at(24),
    });
    expect(onTime).toMatchObject({ ok: true, remaining: 0 });
  });

  it("still counts deleted jokes toward the limit", async () => {
    await postMany(POSTS_PER_DAY);
    await db.update(jokes).set({ status: "deleted" });
    const result = await createJoke(db, {
      authorId,
      text: "Deleting doesn't refund",
      now: at(3),
    });
    expect(result).toMatchObject({ ok: false, reason: "rate_limited" });
  });

  it("counts each member separately", async () => {
    await postMany(POSTS_PER_DAY);
    const other = await upsertUserFromProvider(
      db,
      {
        provider: "dev",
        providerAccountId: "dev-priya",
        name: "Priya",
        image: null,
        email: null,
      },
      { id: "dev-priya" },
    );
    const result = await createJoke(db, {
      authorId: other.id,
      text: "Priya's first joke here",
      now: at(1),
    });
    expect(result.ok).toBe(true);
  });

  it("never allows more than the limit under concurrent submits", async () => {
    await postMany(POSTS_PER_DAY - 1);
    const results = await Promise.all(
      [1, 2, 3].map((n) =>
        createJoke(db, { authorId, text: `Concurrent joke ${n}!`, now: at(2) }),
      ),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(
      await db.select().from(jokes).where(eq(jokes.authorId, authorId)),
    ).toHaveLength(POSTS_PER_DAY);
  });

  describe("getPostQuota", () => {
    it("reports the full quota for a new member", async () => {
      expect(await getPostQuota(db, authorId, t0)).toEqual({
        remaining: POSTS_PER_DAY,
        retryAt: null,
      });
    });

    it("reports remaining posts and, at the limit, when posting reopens", async () => {
      await postMany(3);
      expect(await getPostQuota(db, authorId, at(1))).toEqual({
        remaining: POSTS_PER_DAY - 3,
        retryAt: null,
      });

      await postMany(POSTS_PER_DAY - 3);
      expect(await getPostQuota(db, authorId, at(5))).toEqual({
        remaining: 0,
        retryAt: at(24),
      });
    });

    it("ignores posts older than 24h", async () => {
      await postMany(POSTS_PER_DAY);
      expect(await getPostQuota(db, authorId, at(30))).toEqual({
        remaining: POSTS_PER_DAY,
        retryAt: null,
      });
    });
  });
});

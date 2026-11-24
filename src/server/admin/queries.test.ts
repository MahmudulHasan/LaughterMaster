// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb, type Db } from "../db/client";
import { runMigrations } from "../db/migrate";
import { jokes, users } from "../db/schema";
import {
  createJoke,
  getJokeForViewer,
  getProfile,
  listJokes,
} from "../jokes/queries";
import type { JokeStatus } from "../jokes/types";
import { castVote } from "../jokes/votes";
import {
  REPORTS_PER_DAY,
  REPORTS_TO_HIDE,
  banUser,
  hasReported,
  listModerationQueue,
  reportJoke,
  restoreJoke,
} from "./queries";

const NOW = new Date("2026-11-24T12:00:00.000Z");
let db: Db;

const members = ["mina", "priya", "alex", "r1", "r2", "r3", "r4", "r5"];

async function addJoke(
  id: string,
  authorId = "mina",
  status: JokeStatus = "approved",
) {
  await db.insert(jokes).values({
    id,
    authorId,
    text: `Joke ${id} is funny`,
    normalizedText: `joke ${id} is funny`,
    status,
  });
}

const report = (jokeId: string, userId: string) =>
  reportJoke(db, { jokeId, userId, reason: "Offensive", now: NOW });

async function status(id: string) {
  const [row] = await db
    .select({ status: jokes.status })
    .from(jokes)
    .where(eq(jokes.id, id));
  return row?.status;
}

beforeEach(async () => {
  db = createDb({ inMemory: true });
  await runMigrations(db);
  for (const id of members) {
    await db.insert(users).values({
      id,
      provider: "dev",
      providerAccountId: id,
      displayName: `Name ${id}`,
    });
  }
});

afterEach(async () => {
  await db.$client.close();
});

describe("reportJoke (US-15)", () => {
  it("records one report per member and joke", async () => {
    await addJoke("j1");
    expect(await report("j1", "priya")).toEqual({ ok: true, hidden: false });
    expect(await report("j1", "priya")).toEqual({
      ok: false,
      error: "already_reported",
    });
    expect(await hasReported(db, "j1", "priya")).toBe(true);
    expect(await hasReported(db, "j1", "alex")).toBe(false);
  });

  it("refuses your own joke, unpublished jokes and unknown members", async () => {
    await addJoke("j1");
    await addJoke("pending", "mina", "pending");
    expect(await report("j1", "mina")).toEqual({
      ok: false,
      error: "own_joke",
    });
    expect(await report("pending", "priya")).toEqual({
      ok: false,
      error: "not_found",
    });
    expect(await report("j1", "ghost")).toEqual({
      ok: false,
      error: "not_signed_in",
    });
  });

  it(`hides the joke at ${REPORTS_TO_HIDE} different reports (D3)`, async () => {
    await addJoke("j1");
    const reporters = ["r1", "r2", "r3", "r4"];
    for (const r of reporters) {
      expect(await report("j1", r)).toEqual({ ok: true, hidden: false });
    }
    expect(await status("j1")).toBe("approved");
    expect(await report("j1", "r5")).toEqual({ ok: true, hidden: true });
    expect(await status("j1")).toBe("hidden");
    expect(await getJokeForViewer(db, "j1", null)).toBeNull();
    expect((await listJokes(db)).jokes.map((j) => j.id)).not.toContain("j1");
  });

  it(`limits a member to ${REPORTS_PER_DAY} reports per 24 hours`, async () => {
    for (let i = 0; i < REPORTS_PER_DAY + 1; i++) await addJoke(`j${i}`);
    for (let i = 0; i < REPORTS_PER_DAY; i++) {
      expect((await report(`j${i}`, "priya")).ok).toBe(true);
    }
    expect(await report(`j${REPORTS_PER_DAY}`, "priya")).toEqual({
      ok: false,
      error: "rate_limited",
    });
  });
});

describe("admin queue (US-16)", () => {
  it("lists hidden jokes first with their reports, then pending ones", async () => {
    await addJoke("pending", "mina", "pending");
    await addJoke("hidden");
    for (const r of ["r1", "r2", "r3", "r4", "r5"]) await report("hidden", r);
    await addJoke("fine");

    const queue = await listModerationQueue(db);
    expect(queue.map((q) => [q.id, q.status])).toEqual([
      ["hidden", "hidden"],
      ["pending", "pending"],
    ]);
    expect(queue[0]).toMatchObject({
      reportCount: 5,
      reportReasons: { Offensive: 5 },
    });
    expect(JSON.stringify(queue)).not.toContain("@");
  });

  it("restore publishes the joke and clears its reports", async () => {
    await addJoke("hidden");
    for (const r of ["r1", "r2", "r3", "r4", "r5"]) await report("hidden", r);
    expect(await restoreJoke(db, { jokeId: "hidden", now: NOW })).toBe(true);
    expect(await status("hidden")).toBe("approved");
    // Reports were cleared, so one new report doesn't hide it again.
    expect(await report("hidden", "r1")).toEqual({ ok: true, hidden: false });
    expect(await restoreJoke(db, { jokeId: "hidden", now: NOW })).toBe(false);
  });

  it("ban stops posting, voting and reporting and hides everything", async () => {
    await addJoke("by-mina");
    await addJoke("by-priya", "priya");
    expect(await banUser(db, "mina")).toBe(true);
    expect(await banUser(db, "mina")).toBe(false);

    expect(
      await createJoke(db, { authorId: "mina", text: "A new joke from a ban" }),
    ).toEqual({ ok: false, error: "not_signed_in" });
    expect(
      await castVote(db, { jokeId: "by-priya", userId: "mina", value: 1 }),
    ).toEqual({ ok: false, error: "not_signed_in" });
    expect(await report("by-priya", "mina")).toEqual({
      ok: false,
      error: "not_signed_in",
    });
    expect(await getJokeForViewer(db, "by-mina", null)).toBeNull();
    expect(await getProfile(db, "mina")).toBeNull();
  });
});

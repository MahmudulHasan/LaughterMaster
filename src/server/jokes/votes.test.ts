// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb, type Db } from "../db/client";
import { runMigrations } from "../db/migrate";
import { jokes, users } from "../db/schema";
import type { JokeStatus, JokeView } from "./types";
import {
  castVote,
  getMyJokeStats,
  getTopJokes,
  rankJokes,
  withMyVotes,
  type ScoredJoke,
} from "./votes";

const HOUR = 60 * 60 * 1000;
const NOW = new Date("2026-11-23T12:00:00.000Z");
const ago = (hours: number) => new Date(NOW.getTime() - hours * HOUR);

function view(id: string, hoursAgo: number): JokeView {
  return {
    id,
    text: `Joke ${id}`,
    status: "approved",
    author: { id: "a", displayName: "A", avatarUrl: null },
    createdAt: ago(hoursAgo).toISOString(),
    isBot: false,
    category: null,
  };
}

function scored(
  id: string,
  hoursAgo: number,
  likes = 0,
  dislikes = 0,
): ScoredJoke {
  return { joke: view(id, hoursAgo), likes, dislikes };
}

describe("rankJokes (US-10)", () => {
  it.each([
    {
      name: "higher score first",
      input: [scored("low", 1, 1), scored("high", 2, 5)],
      today: ["high", "low"],
    },
    {
      name: "score is likes minus dislikes",
      input: [scored("popular", 1, 10, 9), scored("quiet", 2, 2, 0)],
      today: ["quiet", "popular"],
    },
    {
      name: "tie on score: more total votes wins",
      input: [scored("few", 1, 1, 0), scored("many", 2, 6, 5)],
      today: ["many", "few"],
    },
    {
      name: "tie on score and votes: earlier post wins",
      input: [scored("copycat", 1, 3), scored("original", 5, 3)],
      today: ["original", "copycat"],
    },
    {
      name: "full tie: stable by id",
      input: [scored("b", 3, 2), scored("a", 3, 2)],
      today: ["a", "b"],
    },
    {
      name: "negative scores still rank, below zero-vote jokes",
      input: [scored("disliked", 1, 0, 3), scored("new", 2)],
      today: ["new", "disliked"],
    },
  ])("$name", ({ input, today }) => {
    const result = rankJokes(input, NOW);
    expect(result.today.map((j) => j.id)).toEqual(today);
    expect(result.today.map((j) => j.rank)).toEqual(today.map((_, i) => i + 1));
  });

  it("uses a rolling 24-hour window for today", () => {
    const result = rankJokes(
      [
        scored("just-inside", 23.99, 0),
        scored("exactly-24h", 24, 50),
        scored("future", -1, 99),
      ],
      NOW,
    );
    expect(result.today.map((j) => j.id)).toEqual(["just-inside"]);
    // Exactly 24h old belongs to the week fill; future posts are ignored.
    expect(result.week.map((j) => j.id)).toEqual(["exactly-24h"]);
  });

  it("fills from days 1–7 under 'From this week', continuing the ranks", () => {
    const result = rankJokes(
      [
        scored("today-1", 2, 1),
        scored("week-best", 30, 20),
        scored("week-ok", 100, 5),
        scored("too-old", 7 * 24, 100),
      ],
      NOW,
    );
    expect(result.today.map((j) => [j.id, j.rank])).toEqual([["today-1", 1]]);
    expect(result.week.map((j) => [j.id, j.rank])).toEqual([
      ["week-best", 2],
      ["week-ok", 3],
    ]);
  });

  it("caps at 10 in total and doesn't fill when today is full", () => {
    const todays = Array.from({ length: 12 }, (_, i) =>
      scored(`t${String(i).padStart(2, "0")}`, 1 + i, 12 - i),
    );
    const result = rankJokes([...todays, scored("week", 30, 999)], NOW);
    expect(result.today).toHaveLength(10);
    expect(result.today[0]!.id).toBe("t00");
    expect(result.week).toEqual([]);
  });

  it("fills only the remaining slots from the week", () => {
    const todays = Array.from({ length: 7 }, (_, i) => scored(`t${i}`, 1 + i));
    const weeks = Array.from({ length: 5 }, (_, i) =>
      scored(`w${i}`, 30 + i, 5 - i),
    );
    const result = rankJokes([...todays, ...weeks], NOW);
    expect(result.today).toHaveLength(7);
    expect(result.week.map((j) => j.id)).toEqual(["w0", "w1", "w2"]);
    expect(result.week.map((j) => j.rank)).toEqual([8, 9, 10]);
  });

  it("is empty when there are no jokes", () => {
    expect(rankJokes([], NOW)).toEqual({ today: [], week: [] });
  });
});

describe("with a database", () => {
  let db: Db;

  async function addUser(id: string, isBanned = false) {
    await db.insert(users).values({
      id,
      provider: "dev",
      providerAccountId: id,
      displayName: `Name ${id}`,
      email: `${id}@example.com`,
      isBanned,
    });
  }

  async function addJoke(
    id: string,
    authorId: string,
    opts: { status?: JokeStatus; hoursAgo?: number; isBot?: boolean } = {},
  ) {
    await db.insert(jokes).values({
      id,
      authorId,
      text: `Joke ${id} is funny`,
      normalizedText: `joke ${id} is funny`,
      status: opts.status ?? "approved",
      isBot: opts.isBot ?? false,
      createdAt: ago(opts.hoursAgo ?? 1),
    });
  }

  const vote = (jokeId: string, userId: string, value: 1 | -1) =>
    castVote(db, { jokeId, userId, value, now: NOW });

  beforeEach(async () => {
    db = createDb({ inMemory: true });
    await runMigrations(db);
    for (const id of ["mina", "priya", "alex"]) await addUser(id);
    await addUser("banned", true);
  });

  afterEach(async () => {
    await db.$client.close();
  });

  describe("castVote (US-8)", () => {
    beforeEach(async () => {
      await addJoke("j1", "mina");
    });

    it("adds, switches and removes a vote", async () => {
      expect(await vote("j1", "priya", 1)).toEqual({ ok: true, myVote: 1 });
      expect(await vote("j1", "priya", -1)).toEqual({ ok: true, myVote: -1 });
      expect(await vote("j1", "priya", -1)).toEqual({
        ok: true,
        myVote: null,
      });
      expect(await vote("j1", "priya", 1)).toEqual({ ok: true, myVote: 1 });
      // Still one row: one vote per member per joke.
      const stats = await getMyJokeStats(db, "mina");
      expect(stats[0]).toMatchObject({ likes: 1, dislikes: 0, score: 1 });
    });

    it("rejects voting on your own joke", async () => {
      expect(await vote("j1", "mina", 1)).toEqual({
        ok: false,
        error: "own_joke",
      });
    });

    it("rejects unknown, unapproved and banned-author jokes", async () => {
      await addJoke("pending", "mina", { status: "pending" });
      await addJoke("deleted", "mina", { status: "deleted" });
      await addJoke("by-banned", "banned");
      for (const id of ["nope", "pending", "deleted", "by-banned"]) {
        expect(await vote(id, "priya", 1)).toEqual({
          ok: false,
          error: "not_found",
        });
      }
    });

    it("treats unknown or banned voters as signed out", async () => {
      for (const userId of ["ghost", "banned"]) {
        expect(await vote("j1", userId, 1)).toEqual({
          ok: false,
          error: "not_signed_in",
        });
      }
    });
  });

  describe("withMyVotes", () => {
    it("attaches only the viewer's own vote", async () => {
      await addJoke("j1", "mina");
      await addJoke("j2", "mina");
      await vote("j1", "priya", 1);
      await vote("j2", "alex", -1);
      const list = [view("j1", 1), view("j2", 1)];
      const forPriya = await withMyVotes(db, "priya", list);
      expect(forPriya.map((j) => j.myVote)).toEqual([1, null]);
      const forVisitor = await withMyVotes(db, null, list);
      expect(forVisitor.map((j) => j.myVote)).toEqual([undefined, undefined]);
    });
  });

  describe("getTopJokes (US-10)", () => {
    it("ranks eligible jokes and fills from the week", async () => {
      await addJoke("today-a", "mina", { hoursAgo: 2 });
      await addJoke("today-b", "priya", { hoursAgo: 3 });
      await addJoke("week", "alex", { hoursAgo: 48 });
      await addJoke("old", "alex", { hoursAgo: 24 * 8 });
      await addJoke("bot", "alex", { hoursAgo: 1, isBot: true });
      await addJoke("pending", "mina", { hoursAgo: 1, status: "pending" });
      await addJoke("by-banned", "banned", { hoursAgo: 1 });
      await vote("today-b", "mina", 1);
      await vote("today-b", "alex", 1);
      await vote("today-a", "priya", 1);

      const top = await getTopJokes(db, NOW);
      expect(top.today.map((j) => [j.id, j.rank])).toEqual([
        ["today-b", 1],
        ["today-a", 2],
      ]);
      expect(top.week.map((j) => [j.id, j.rank])).toEqual([["week", 3]]);
      // No counts and no email leak into the ranking.
      expect(JSON.stringify(top)).not.toMatch(/likes|dislikes|example\.com/);
    });
  });

  describe("getMyJokeStats (US-9)", () => {
    it("lists the author's approved and pending jokes with counts", async () => {
      await addJoke("old", "mina", { hoursAgo: 5 });
      await addJoke("new", "mina", { hoursAgo: 1, status: "pending" });
      await addJoke("gone", "mina", { hoursAgo: 2, status: "deleted" });
      await addJoke("theirs", "priya", { hoursAgo: 1 });
      await vote("old", "priya", 1);
      await vote("old", "alex", -1);
      await vote("theirs", "mina", 1);

      const stats = await getMyJokeStats(db, "mina");
      expect(
        stats.map((s) => [s.id, s.status, s.likes, s.dislikes, s.score]),
      ).toEqual([
        ["new", "pending", 0, 0, 0],
        ["old", "approved", 1, 1, 0],
      ]);
      expect(JSON.stringify(stats)).not.toContain("example.com");
    });
  });
});

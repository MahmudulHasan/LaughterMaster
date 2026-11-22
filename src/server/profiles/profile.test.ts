// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb, type Db } from "../db/client";
import { runMigrations } from "../db/migrate";
import { jokes, users, type JokeStatus } from "../db/schema";
import { upsertUserFromProvider } from "../users";

import { getPublicProfile, listPendingJokes } from "./profile";

const joined = new Date("2026-11-03T08:00:00Z");

describe("profiles", () => {
  let db: Db;
  let seq = 0;

  async function add(status: JokeStatus, author = "dev-mina", minute = seq) {
    const id = `j${++seq}`;
    await db.insert(jokes).values({
      id,
      authorId: author,
      text: `Joke ${id} text here`,
      normalizedText: id,
      status,
      createdAt: new Date(Date.UTC(2026, 10, 22, 0, minute)),
    });
    return id;
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
          name: id === "dev-mina" ? "Mina Park" : "Priya S.",
          image: null,
          email: `${id}@example.com`,
        },
        { id },
      );
    }
    await db.update(users).set({ createdAt: joined });
  });

  afterEach(async () => {
    await db.$client.close();
  });

  describe("getPublicProfile", () => {
    it("returns name, avatar, join date and the count of approved jokes only", async () => {
      await add("approved");
      await add("approved");
      for (const s of ["pending", "rejected", "hidden", "removed", "deleted"])
        await add(s as JokeStatus);
      await add("approved", "dev-priya");

      expect(await getPublicProfile(db, "dev-mina")).toEqual({
        id: "dev-mina",
        displayName: "Mina Park",
        avatarUrl: null,
        joinedAt: joined,
        jokeCount: 2,
      });
    });

    it("counts zero for a member with no approved jokes", async () => {
      expect((await getPublicProfile(db, "dev-mina"))?.jokeCount).toBe(0);
    });

    it("returns null for an unknown member", async () => {
      expect(await getPublicProfile(db, "nobody")).toBeNull();
    });

    it("returns null for a banned member", async () => {
      await db
        .update(users)
        .set({ isBanned: true })
        .where(eq(users.id, "dev-mina"));
      expect(await getPublicProfile(db, "dev-mina")).toBeNull();
    });

    it("never includes email", async () => {
      const profile = await getPublicProfile(db, "dev-mina");
      expect(JSON.stringify(profile)).not.toContain("@example.com");
    });
  });

  describe("listPendingJokes", () => {
    it("returns only the member's own pending jokes, newest first", async () => {
      const older = await add("pending");
      await add("approved");
      const newer = await add("pending");
      await add("pending", "dev-priya");

      const pending = await listPendingJokes(db, "dev-mina");
      expect(pending.map((j) => j.id)).toEqual([newer, older]);
      expect(pending[0]?.author).toEqual({
        id: "dev-mina",
        displayName: "Mina Park",
        avatarUrl: null,
      });
    });
  });
});

// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb, type Db } from "../db/client";
import { runMigrations } from "../db/migrate";
import { jokes, users, type JokeStatus } from "../db/schema";
import { upsertUserFromProvider } from "../users";

import { createJoke } from "./jokes";
import { getPublicJoke } from "./read";

const t0 = new Date("2026-11-22T12:00:00Z");

describe("getPublicJoke", () => {
  let db: Db;
  let jokeId: string;

  beforeEach(async () => {
    db = createDb({ inMemory: true });
    await runMigrations(db);
    await upsertUserFromProvider(
      db,
      {
        provider: "dev",
        providerAccountId: "dev-priya",
        name: "Priya S.",
        image: "https://example.com/p.png",
        email: "priya@example.com",
      },
      { id: "dev-priya" },
    );
    const result = await createJoke(db, {
      authorId: "dev-priya",
      text: "I told my suitcase there's no vacation this year.",
      now: t0,
    });
    if (!result.ok) throw new Error("setup failed");
    jokeId = result.joke.id;
  });

  afterEach(async () => {
    await db.$client.close();
  });

  it("returns an approved joke with its public author, and no email", async () => {
    await db
      .update(jokes)
      .set({ category: "Puns" })
      .where(eq(jokes.id, jokeId));
    const joke = await getPublicJoke(db, jokeId);
    expect(joke).toEqual({
      id: jokeId,
      text: "I told my suitcase there's no vacation this year.",
      category: "Puns",
      isBot: false,
      createdAt: t0,
      author: {
        id: "dev-priya",
        displayName: "Priya S.",
        avatarUrl: "https://example.com/p.png",
      },
    });
    expect(JSON.stringify(joke)).not.toContain("priya@example.com");
  });

  it("returns null for an unknown id", async () => {
    expect(await getPublicJoke(db, "no-such-joke")).toBeNull();
  });

  it.each<JokeStatus>(["pending", "rejected", "hidden", "removed", "deleted"])(
    "returns null for a %s joke",
    async (status) => {
      await db.update(jokes).set({ status }).where(eq(jokes.id, jokeId));
      expect(await getPublicJoke(db, jokeId)).toBeNull();
    },
  );

  it("returns null when the author is banned (US-16)", async () => {
    await db
      .update(users)
      .set({ isBanned: true })
      .where(eq(users.id, "dev-priya"));
    expect(await getPublicJoke(db, jokeId)).toBeNull();
  });
});

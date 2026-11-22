// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb, type Db } from "../db/client";
import { runMigrations } from "../db/migrate";
import { jokes, type JokeStatus } from "../db/schema";
import { upsertUserFromProvider } from "../users";

import { deleteJoke } from "./delete";
import { createJoke } from "./jokes";
import { getPublicJoke } from "./read";

describe("deleteJoke", () => {
  let db: Db;
  let jokeId: string;

  const statusOf = async (id: string) =>
    (await db.select().from(jokes).where(eq(jokes.id, id)))[0]?.status;

  beforeEach(async () => {
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
          email: null,
        },
        { id },
      );
    }
    const result = await createJoke(db, {
      authorId: "dev-mina",
      text: "A joke Mina regrets posting",
    });
    if (!result.ok) throw new Error("setup failed");
    jokeId = result.joke.id;
  });

  afterEach(async () => {
    await db.$client.close();
  });

  it("lets the author delete their joke, which then disappears", async () => {
    expect(await deleteJoke(db, { jokeId, userId: "dev-mina" })).toBe(
      "deleted",
    );
    expect(await statusOf(jokeId)).toBe("deleted");
    expect(await getPublicJoke(db, jokeId)).toBeNull();
  });

  it("keeps the row (soft delete) so the daily post limit still counts it", async () => {
    await deleteJoke(db, { jokeId, userId: "dev-mina" });
    expect(await db.select().from(jokes)).toHaveLength(1);
  });

  it("refuses another member, answering as if the joke didn't exist", async () => {
    expect(await deleteJoke(db, { jokeId, userId: "dev-priya" })).toBe(
      "not_found",
    );
    expect(await statusOf(jokeId)).toBe("approved");
  });

  it("returns not_found for an unknown joke", async () => {
    expect(await deleteJoke(db, { jokeId: "nope", userId: "dev-mina" })).toBe(
      "not_found",
    );
  });

  it("returns not_found when the joke is already deleted", async () => {
    await deleteJoke(db, { jokeId, userId: "dev-mina" });
    expect(await deleteJoke(db, { jokeId, userId: "dev-mina" })).toBe(
      "not_found",
    );
  });

  it.each<JokeStatus>(["pending", "hidden", "rejected"])(
    "lets the author delete a %s joke",
    async (status) => {
      await db.update(jokes).set({ status }).where(eq(jokes.id, jokeId));
      expect(await deleteJoke(db, { jokeId, userId: "dev-mina" })).toBe(
        "deleted",
      );
    },
  );

  it("keeps an admin removal as removed", async () => {
    await db
      .update(jokes)
      .set({ status: "removed" })
      .where(eq(jokes.id, jokeId));
    expect(await deleteJoke(db, { jokeId, userId: "dev-mina" })).toBe(
      "not_found",
    );
    expect(await statusOf(jokeId)).toBe("removed");
  });
});

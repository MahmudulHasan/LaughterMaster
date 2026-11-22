// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createDb, type Db } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { jokes } from "@/server/db/schema";
import { upsertUserFromProvider } from "@/server/users";

import { GET } from "./route";

let db: Db;
vi.mock("@/server/db/app-db", () => ({ getAppDb: async () => db }));

const get = (query = "") =>
  GET(new NextRequest(`http://localhost/api/jokes${query}`));

describe("GET /api/jokes", () => {
  beforeEach(async () => {
    db = createDb({ inMemory: true });
    await runMigrations(db);
    await upsertUserFromProvider(
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
    for (let i = 0; i < 25; i++) {
      await db.insert(jokes).values({
        id: `j${String(i).padStart(2, "0")}`,
        authorId: "dev-mina",
        text: `Joke number ${i} is here`,
        normalizedText: `joke ${i}`,
        status: "approved",
        createdAt: new Date(Date.UTC(2026, 10, 22, 0, i)),
      });
    }
  });

  afterEach(async () => {
    await db.$client.close();
  });

  it("returns the first 20 jokes and a cursor as JSON", async () => {
    const res = await get();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.jokes).toHaveLength(20);
    expect(body.jokes[0]).toEqual({
      id: "j24",
      text: "Joke number 24 is here",
      category: null,
      isBot: false,
      createdAt: "2026-11-22T00:24:00.000Z",
      author: { id: "dev-mina", displayName: "Mina", avatarUrl: null },
    });
    expect(body.nextCursor).toBe("j05");
  });

  it("follows the cursor to the last batch", async () => {
    const body = await (await get("?cursor=j05")).json();
    expect(body.jokes.map((j: { id: string }) => j.id)).toEqual([
      "j04",
      "j03",
      "j02",
      "j01",
      "j00",
    ]);
    expect(body.nextCursor).toBeNull();
  });

  it("filters by author", async () => {
    const body = await (await get("?author=someone-else")).json();
    expect(body).toEqual({ jokes: [], nextCursor: null });
  });

  it("answers 400 for an unknown or malformed cursor", async () => {
    expect((await get("?cursor=nope")).status).toBe(400);
    expect((await get(`?cursor=${"x".repeat(200)}`)).status).toBe(400);
  });

  it("never includes email", async () => {
    expect(await (await get()).text()).not.toContain("@example.com");
  });
});

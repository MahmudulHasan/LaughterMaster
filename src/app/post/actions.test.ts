// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { createDb, type Db } from "@/server/db/client";
import { runMigrations } from "@/server/db/migrate";
import { jokes } from "@/server/db/schema";
import { POSTS_PER_DAY } from "@/server/jokes/jokes";
import { upsertUserFromProvider } from "@/server/users";

import { postJokeAction } from "./actions";

let db: Db;
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/db/app-db", () => ({ getAppDb: async () => db }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const signedInAs = (id: string) =>
  mockAuth.mockResolvedValue({ user: { id, name: "Mina", image: null } });

function form(text: string) {
  const data = new FormData();
  data.set("text", text);
  return data;
}

describe("postJokeAction", () => {
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
        email: null,
      },
      { id: "dev-mina" },
    );
    mockAuth.mockReset();
  });

  afterEach(async () => {
    await db.$client.close();
  });

  it("refuses visitors who aren't signed in and saves nothing", async () => {
    mockAuth.mockResolvedValue(null);
    const state = await postJokeAction(
      { status: "idle" },
      form("A perfectly good joke"),
    );
    expect(state).toEqual({
      status: "error",
      message: "Sign in to post a joke.",
    });
    expect(await db.select().from(jokes)).toHaveLength(0);
  });

  it("posts as the signed-in member", async () => {
    signedInAs("dev-mina");
    const state = await postJokeAction(
      { status: "idle" },
      form("A perfectly good joke"),
    );
    expect(state).toEqual({
      status: "posted",
      jokeId: expect.any(String),
      remaining: POSTS_PER_DAY - 1,
    });
    const [row] = await db.select().from(jokes);
    expect(row?.authorId).toBe("dev-mina");
  });

  it("returns the validation message for invalid text", async () => {
    signedInAs("dev-mina");
    const state = await postJokeAction({ status: "idle" }, form("short"));
    expect(state).toEqual({
      status: "error",
      message: "A bit short. Jokes need at least 10 characters.",
    });
  });

  it("returns an ISO retry time once the daily limit is reached", async () => {
    signedInAs("dev-mina");
    for (let i = 0; i < POSTS_PER_DAY; i++) {
      await postJokeAction({ status: "idle" }, form(`Joke number ${i} here`));
    }
    const state = await postJokeAction(
      { status: "idle" },
      form("One joke too many"),
    );
    expect(state).toEqual({
      status: "rate_limited",
      retryAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import type { JokeView } from "./types";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth }));

const db = { fake: "db" };
vi.mock("@/server/db/ready", () => ({ getReadyDb: async () => db }));

const createJoke = vi.fn();
const deleteJoke = vi.fn();
const countRecentPosts = vi.fn();
vi.mock("@/server/jokes/queries", () => ({
  createJoke,
  deleteJoke,
  countRecentPosts,
}));

vi.mock("next/server", () => ({ connection: async () => {} }));

class RedirectError extends Error {
  constructor(public url: string) {
    super(`NEXT_REDIRECT ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

const { createJokeAction, deleteJokeAction, getPostsLeftToday } =
  await import("./actions");

const session = { user: { id: "u1", name: "Mina", image: null }, expires: "" };

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const joke: JokeView = {
  id: "j-1",
  text: "Why did the scarecrow win? Outstanding in his field.",
  status: "approved",
  author: { id: "u1", displayName: "Mina", avatarUrl: null },
  createdAt: "2026-11-22T10:00:00.000Z",
  isBot: false,
  category: null,
};

beforeEach(() => {
  auth.mockReset();
  createJoke.mockReset();
  deleteJoke.mockReset();
  countRecentPosts.mockReset();
  auth.mockResolvedValue(session);
});

describe("createJokeAction", () => {
  it("refuses when logged out, without touching the database", async () => {
    auth.mockResolvedValue(null);
    expect(
      await createJokeAction(null, form({ text: "A perfectly fine joke" })),
    ).toEqual({ error: "not_signed_in" });
    expect(createJoke).not.toHaveBeenCalled();
  });

  it.each([
    ["empty", ""],
    ["9 graphemes", "123456789"],
    ["only spaces around a short text", "    short    "],
    ["9 emoji (multi-code-unit graphemes)", "👨‍👩‍👧‍👦".repeat(9)],
  ])("rejects %s as too_short", async (_label, text) => {
    expect(await createJokeAction(null, form({ text }))).toEqual({
      error: "too_short",
    });
    expect(createJoke).not.toHaveBeenCalled();
  });

  it("rejects a missing field as too_short", async () => {
    expect(await createJokeAction(null, new FormData())).toEqual({
      error: "too_short",
    });
  });

  it.each([
    ["501 characters", "a".repeat(501)],
    ["a huge payload", "a".repeat(50_000)],
  ])("rejects %s as too_long", async (_label, text) => {
    expect(await createJokeAction(null, form({ text }))).toEqual({
      error: "too_long",
    });
    expect(createJoke).not.toHaveBeenCalled();
  });

  it("counts graphemes, so 500 emoji are allowed", async () => {
    createJoke.mockResolvedValue({ ok: true, joke });
    await expect(
      createJokeAction(null, form({ text: "😂".repeat(500) })),
    ).rejects.toMatchObject({ url: "/joke/j-1" });
  });

  it("accepts a joke in Hindi", async () => {
    createJoke.mockResolvedValue({ ok: true, joke });
    await expect(
      createJokeAction(null, form({ text: "मेरा चुटकुला सुनो, बहुत मज़ेदार है" })),
    ).rejects.toMatchObject({ url: "/joke/j-1" });
  });

  it("creates the joke for the session user and redirects to its page", async () => {
    createJoke.mockResolvedValue({ ok: true, joke });
    await expect(
      createJokeAction(null, form({ text: `  ${joke.text}  ` })),
    ).rejects.toMatchObject({ url: "/joke/j-1" });
    expect(createJoke).toHaveBeenCalledWith(db, {
      authorId: "u1",
      text: `  ${joke.text}  `,
    });
  });

  it("passes rate_limited through with the retry time", async () => {
    createJoke.mockResolvedValue({
      ok: false,
      error: "rate_limited",
      retryAt: "2026-11-23T09:00:00.000Z",
    });
    expect(await createJokeAction(null, form({ text: joke.text }))).toEqual({
      error: "rate_limited",
      retryAt: "2026-11-23T09:00:00.000Z",
    });
  });

  it("passes the data layer's own validation errors through", async () => {
    createJoke.mockResolvedValue({ ok: false, error: "too_short" });
    expect(await createJokeAction(null, form({ text: joke.text }))).toEqual({
      error: "too_short",
    });
  });
});

describe("deleteJokeAction", () => {
  it("deletes the author's joke and goes to their profile", async () => {
    deleteJoke.mockResolvedValue(true);
    await expect(
      deleteJokeAction(form({ jokeId: "j-1" })),
    ).rejects.toMatchObject({ url: "/u/u1" });
    expect(deleteJoke).toHaveBeenCalledWith(db, {
      jokeId: "j-1",
      userId: "u1",
    });
  });

  it("returns to the joke page when the caller isn't the author", async () => {
    deleteJoke.mockResolvedValue(false);
    await expect(
      deleteJokeAction(form({ jokeId: "j-1" })),
    ).rejects.toMatchObject({ url: "/joke/j-1" });
  });

  it("never deletes when logged out", async () => {
    auth.mockResolvedValue(null);
    await expect(
      deleteJokeAction(form({ jokeId: "j-1" })),
    ).rejects.toMatchObject({ url: "/joke/j-1" });
    expect(deleteJoke).not.toHaveBeenCalled();
  });

  it("ignores a request without a joke id", async () => {
    await expect(deleteJokeAction(new FormData())).rejects.toMatchObject({
      url: "/",
    });
    expect(deleteJoke).not.toHaveBeenCalled();
  });
});

describe("getPostsLeftToday", () => {
  it("is null when logged out", async () => {
    auth.mockResolvedValue(null);
    expect(await getPostsLeftToday()).toBeNull();
    expect(countRecentPosts).not.toHaveBeenCalled();
  });

  it("subtracts the session user's recent posts from 10, never below 0", async () => {
    countRecentPosts.mockResolvedValue(3);
    expect(await getPostsLeftToday()).toBe(7);
    expect(countRecentPosts).toHaveBeenCalledWith(db, "u1");
    countRecentPosts.mockResolvedValue(12);
    expect(await getPostsLeftToday()).toBe(0);
  });
});

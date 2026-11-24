// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
vi.mock("@/auth", () => ({ auth }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/db/ready", () => ({ getReadyDb: async () => "db" }));
const isAdmin = vi.fn<(id: string | null | undefined) => boolean>();
vi.mock("@/server/auth/admin", () => ({ isAdmin }));
const removeJokeAsAdmin = vi.fn();
vi.mock("@/server/jokes/queries", () => ({ removeJokeAsAdmin }));
const banUser = vi.fn();
const restoreJoke = vi.fn();
const reportJoke = vi.fn();
vi.mock("./queries", () => ({ banUser, restoreJoke, reportJoke }));
class RedirectError extends Error {
  constructor(public url: string) {
    super(url);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new RedirectError(url);
  },
}));

const {
  banUserAction,
  removeJokeFromQueueAction,
  restoreJokeAction,
  reportJokeAction,
} = await import("./actions");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "u1" } });
  isAdmin.mockImplementation((id) => id === "admin");
});

describe("admin actions (US-16)", () => {
  it("refuse non-admins without touching the database", async () => {
    for (const action of [restoreJokeAction, removeJokeFromQueueAction]) {
      await expect(action(form({ jokeId: "j1" }))).rejects.toMatchObject({
        url: "/",
      });
    }
    await expect(banUserAction(form({ userId: "u2" }))).rejects.toMatchObject({
      url: "/",
    });
    expect(restoreJoke).not.toHaveBeenCalled();
    expect(removeJokeAsAdmin).not.toHaveBeenCalled();
    expect(banUser).not.toHaveBeenCalled();
  });

  it("let admins restore, remove and ban, then return to the queue", async () => {
    auth.mockResolvedValue({ user: { id: "admin" } });
    await expect(
      restoreJokeAction(form({ jokeId: "j1" })),
    ).rejects.toMatchObject({ url: "/admin" });
    expect(restoreJoke).toHaveBeenCalledWith("db", { jokeId: "j1" });
    await expect(
      removeJokeFromQueueAction(form({ jokeId: "j2" })),
    ).rejects.toMatchObject({ url: "/admin" });
    expect(removeJokeAsAdmin).toHaveBeenCalledWith("db", { jokeId: "j2" });
    await expect(banUserAction(form({ userId: "u2" }))).rejects.toMatchObject({
      url: "/admin",
    });
    expect(banUser).toHaveBeenCalledWith("db", "u2");
  });

  it("never bans an admin", async () => {
    auth.mockResolvedValue({ user: { id: "admin" } });
    await expect(
      banUserAction(form({ userId: "admin" })),
    ).rejects.toMatchObject({ url: "/admin" });
    expect(banUser).not.toHaveBeenCalled();
  });
});

describe("reportJokeAction (US-15)", () => {
  it("reports as the session user and validates the reason", async () => {
    reportJoke.mockResolvedValue({ ok: true, hidden: false });
    expect(
      await reportJokeAction(
        null,
        form({ jokeId: "j1", reason: "Spam", userId: "x" }),
      ),
    ).toEqual({ ok: true, hidden: false });
    expect(reportJoke).toHaveBeenCalledWith("db", {
      jokeId: "j1",
      reason: "Spam",
      userId: "u1",
    });
    expect(
      await reportJokeAction(null, form({ jokeId: "j1", reason: "Boring" })),
    ).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it("refuses signed-out visitors", async () => {
    auth.mockResolvedValue(null);
    expect(
      await reportJokeAction(null, form({ jokeId: "j1", reason: "Spam" })),
    ).toEqual({
      ok: false,
      error: "not_signed_in",
    });
  });
});

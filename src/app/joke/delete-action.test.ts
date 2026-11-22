// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/auth";
import { deleteJoke } from "@/server/jokes/delete";

import { deleteJokeAction } from "./actions";

vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/db/app-db", () => ({ getAppDb: async () => ({}) }));
vi.mock("@/server/jokes/delete", () => ({ deleteJoke: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockDelete = deleteJoke as unknown as ReturnType<typeof vi.fn>;

describe("deleteJokeAction", () => {
  beforeEach(() => {
    mockAuth.mockReset();
    mockDelete.mockReset();
  });

  it("refuses visitors who aren't signed in", async () => {
    mockAuth.mockResolvedValue(null);
    expect(await deleteJokeAction("j1")).toEqual({
      ok: false,
      message: "Sign in to delete your jokes.",
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("deletes as the signed-in member, never a user id from the client", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "dev-mina", name: "Mina", image: null },
    });
    mockDelete.mockResolvedValue("deleted");
    expect(await deleteJokeAction("j1")).toEqual({ ok: true });
    expect(mockDelete.mock.calls[0]?.[1]).toEqual({
      jokeId: "j1",
      userId: "dev-mina",
    });
  });

  it("explains when the joke can't be deleted", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "dev-priya", name: "Priya", image: null },
    });
    mockDelete.mockResolvedValue("not_found");
    expect(await deleteJokeAction("j1")).toEqual({
      ok: false,
      message: "This joke can't be deleted. It may already be gone.",
    });
  });

  it("rejects a malformed id without touching the database", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "dev-mina", name: "Mina", image: null },
    });
    expect(await deleteJokeAction(42 as unknown as string)).toMatchObject({
      ok: false,
    });
    expect(mockDelete).not.toHaveBeenCalled();
  });
});

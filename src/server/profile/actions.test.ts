// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.fn();
const unstable_update = vi.fn();
vi.mock("@/auth", () => ({ auth, unstable_update }));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("@/server/db/ready", () => ({ getReadyDb: async () => "db" }));
const moderateDisplayName = vi.fn();
vi.mock("@/server/moderation/shared", () => ({
  getModerator: () => ({ moderateDisplayName }),
}));
const setDisplayName = vi.fn();
vi.mock("@/server/users", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/users")>()),
  setDisplayName,
}));

const { updateDisplayNameAction } = await import("./actions");

function form(name: string) {
  const data = new FormData();
  data.set("name", name);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.mockResolvedValue({ user: { id: "u1" } });
  moderateDisplayName.mockResolvedValue({
    kind: "verdict",
    allowed: true,
    reason: "",
    model: "m",
  });
  setDisplayName.mockResolvedValue({
    id: "u1",
    displayName: "Mina P",
    avatarUrl: null,
  });
});

describe("updateDisplayNameAction (US-3)", () => {
  it("validates, checks with Claude, saves and refreshes the session", async () => {
    expect(await updateDisplayNameAction(null, form("  Mina   P "))).toEqual({
      ok: true,
      name: "Mina P",
    });
    expect(moderateDisplayName).toHaveBeenCalledWith("Mina P");
    expect(setDisplayName).toHaveBeenCalledWith("db", "u1", "Mina P");
    expect(unstable_update).toHaveBeenCalled();
  });

  it("rejects invalid names before calling Claude", async () => {
    expect(await updateDisplayNameAction(null, form("x"))).toEqual({
      ok: false,
      error: "too_short",
    });
    expect(moderateDisplayName).not.toHaveBeenCalled();
  });

  it("passes on Claude's reason and keeps the old name", async () => {
    moderateDisplayName.mockResolvedValue({
      kind: "verdict",
      allowed: false,
      reason: "Please choose a name that doesn't target anyone.",
      model: "m",
    });
    expect(await updateDisplayNameAction(null, form("Some Name"))).toEqual({
      ok: false,
      error: "rejected",
      reason: "Please choose a name that doesn't target anyone.",
    });
    expect(setDisplayName).not.toHaveBeenCalled();
  });

  it("fails closed when Claude is unavailable", async () => {
    moderateDisplayName.mockResolvedValue({
      kind: "unavailable",
      error: "timeout",
    });
    expect(await updateDisplayNameAction(null, form("Some Name"))).toEqual({
      ok: false,
      error: "try_later",
    });
    expect(setDisplayName).not.toHaveBeenCalled();
  });

  it("refuses signed-out visitors", async () => {
    auth.mockResolvedValue(null);
    expect(await updateDisplayNameAction(null, form("Some Name"))).toEqual({
      ok: false,
      error: "not_signed_in",
    });
  });
});

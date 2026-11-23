import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { castVote } from "@/server/jokes/votes";

import { POST } from "./route";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/db/ready", () => ({ getReadyDb: vi.fn(async () => "db") }));
vi.mock("@/server/jokes/votes", () => ({ castVote: vi.fn() }));

const { auth } = await import("@/auth");
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;
const mockVote = castVote as unknown as ReturnType<typeof vi.fn>;

function post(body: unknown, id = "j1") {
  const request = new NextRequest(`http://localhost/api/jokes/${id}/vote`, {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
  return POST(request, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: "priya" } });
});

describe("POST /api/jokes/[id]/vote", () => {
  it("votes as the session user and returns the new vote", async () => {
    mockVote.mockResolvedValue({ ok: true, myVote: 1 });
    const res = await post({ value: 1, userId: "someone-else" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ myVote: 1 });
    expect(mockVote).toHaveBeenCalledWith("db", {
      jokeId: "j1",
      userId: "priya",
      value: 1,
    });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("returns 401 when signed out, without voting", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await post({ value: 1 });
    expect(res.status).toBe(401);
    expect(mockVote).not.toHaveBeenCalled();
  });

  it.each([
    ["own_joke", 403],
    ["not_found", 404],
    ["not_signed_in", 401],
  ])("maps %s to HTTP %i", async (error, status) => {
    mockVote.mockResolvedValue({ ok: false, error });
    const res = await post({ value: -1 });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });

  it.each([[{ value: 2 }], [{ value: "1" }], [{}], ["not json"]])(
    "rejects a bad body %j with 400",
    async (body) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(mockVote).not.toHaveBeenCalled();
    },
  );
});

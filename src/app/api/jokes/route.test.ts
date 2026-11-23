import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { encodeCursor } from "@/server/jokes/cursor";
import { getProfile, listJokes, listUserJokes } from "@/server/jokes/queries";
import type { JokePage, ProfileView } from "@/server/jokes/types";

import { GET as getUserJokes } from "../users/[id]/jokes/route";
import { GET as getJokes } from "./route";

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/server/db/ready", () => ({ getReadyDb: vi.fn(async () => "db") }));
vi.mock("@/server/jokes/queries", () => ({
  listJokes: vi.fn(),
  listUserJokes: vi.fn(),
  getProfile: vi.fn(),
}));

const { auth } = await import("@/auth");
const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

const page: JokePage = {
  jokes: [
    {
      id: "j1",
      text: "A joke",
      status: "approved",
      author: { id: "u1", displayName: "Mina", avatarUrl: null },
      createdAt: "2026-11-22T10:00:00.000Z",
      isBot: false,
      category: null,
    },
  ],
  nextCursor: "next",
};
const profile: ProfileView = {
  user: { id: "u1", displayName: "Mina", avatarUrl: null },
  joinedAt: "2026-01-05T00:00:00.000Z",
  approvedJokeCount: 1,
};
const goodCursor = encodeCursor({
  createdAt: "2026-11-22T10:00:00.123456Z",
  id: "j9",
});

const req = (path: string) => new NextRequest(`http://localhost${path}`);
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.mocked(listJokes).mockReset().mockResolvedValue(page);
  vi.mocked(listUserJokes).mockReset().mockResolvedValue(page);
  vi.mocked(getProfile).mockReset().mockResolvedValue(profile);
  mockAuth.mockReset().mockResolvedValue(null);
});

describe("GET /api/jokes", () => {
  it("returns the first page as JokePage JSON", async () => {
    const res = await getJokes(req("/api/jokes"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(page);
    expect(listJokes).toHaveBeenCalledWith("db", { cursor: null });
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("passes the cursor through", async () => {
    await getJokes(req(`/api/jokes?cursor=${goodCursor}`));
    expect(listJokes).toHaveBeenCalledWith("db", { cursor: goodCursor });
  });

  it("treats an empty cursor as the first page", async () => {
    await getJokes(req("/api/jokes?cursor="));
    expect(listJokes).toHaveBeenCalledWith("db", { cursor: null });
  });

  it("rejects a malformed cursor with 400", async () => {
    const res = await getJokes(req("/api/jokes?cursor=not*valid"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_cursor" });
    expect(listJokes).not.toHaveBeenCalled();
  });

  it("never includes an email or vote counts", async () => {
    const body = await (await getJokes(req("/api/jokes"))).text();
    expect(body).not.toMatch(/email|likes|dislikes|score/i);
  });
});

describe("GET /api/users/[id]/jokes", () => {
  it("returns the member's jokes for a visitor", async () => {
    const res = await getUserJokes(
      req(`/api/users/u1/jokes?cursor=${goodCursor}`),
      params("u1"),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(page);
    expect(listUserJokes).toHaveBeenCalledWith("db", {
      userId: "u1",
      viewerId: null,
      cursor: goodCursor,
    });
  });

  it("passes the signed-in viewer so the owner gets pending jokes", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "u1", name: "Mina", image: null },
    });
    await getUserJokes(req("/api/users/u1/jokes"), params("u1"));
    expect(listUserJokes).toHaveBeenCalledWith("db", {
      userId: "u1",
      viewerId: "u1",
      cursor: null,
    });
  });

  it("returns 404 for an unknown or banned member", async () => {
    vi.mocked(getProfile).mockResolvedValue(null);
    const res = await getUserJokes(
      req("/api/users/ghost/jokes"),
      params("ghost"),
    );
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(listUserJokes).not.toHaveBeenCalled();
  });

  it("rejects a malformed cursor with 400", async () => {
    const res = await getUserJokes(
      req("/api/users/u1/jokes?cursor=%%%"),
      params("u1"),
    );
    expect(res.status).toBe(400);
  });
});

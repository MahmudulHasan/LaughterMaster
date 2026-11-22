import { describe, expect, it, vi } from "vitest";

import type { Db } from "@/server/db/client";

import {
  jwtCallback,
  sessionCallback,
  toSessionUser,
  type AuthDeps,
} from "./session";

function makeDeps(): AuthDeps & { upsertUser: ReturnType<typeof vi.fn> } {
  const upsertUser = vi.fn(async (_db: Db, profile: { name: string }) => ({
    id: "db-user-1",
    displayName: profile.name,
    avatarUrl: "https://img.example/a.png",
  }));
  return { getDb: async () => ({}) as Db, upsertUser };
}

describe("jwtCallback", () => {
  it("upserts a Google user and keeps only id, name and picture", async () => {
    const deps = makeDeps();
    const token = await jwtCallback(deps, {
      token: { name: "Mina", email: "mina@example.com", sub: "google-sub" },
      user: {
        id: "google-sub",
        name: "Mina",
        email: "mina@example.com",
        image: "https://img.example/a.png",
      },
      account: {
        provider: "google",
        providerAccountId: "google-sub",
        type: "oidc",
      },
    });
    expect(deps.upsertUser).toHaveBeenCalledWith(
      {},
      {
        provider: "google",
        providerAccountId: "google-sub",
        name: "Mina",
        image: "https://img.example/a.png",
        email: "mina@example.com",
      },
      undefined,
    );
    expect(token).toEqual({
      uid: "db-user-1",
      sub: "db-user-1",
      name: "Mina",
      picture: "https://img.example/a.png",
    });
    expect(JSON.stringify(token)).not.toContain("@");
  });

  it("gives dev users their seeded id", async () => {
    const deps = makeDeps();
    await jwtCallback(deps, {
      token: {},
      user: { id: "dev-priya", name: "Priya S." },
      account: {
        provider: "dev",
        providerAccountId: "dev-priya",
        type: "credentials",
      },
    });
    expect(deps.upsertUser).toHaveBeenCalledWith(
      {},
      {
        provider: "dev",
        providerAccountId: "dev-priya",
        name: "Priya S.",
        image: null,
        email: null,
      },
      { id: "dev-priya" },
    );
  });

  it("rejects unknown providers and unknown dev ids", async () => {
    const deps = makeDeps();
    for (const [provider, id] of [
      ["github", "x"],
      ["dev", "dev-nobody"],
    ]) {
      const token = await jwtCallback(deps, {
        token: {},
        user: { id },
        account: { provider, providerAccountId: id, type: "oauth" },
      });
      expect(token).toBeNull();
    }
    expect(deps.upsertUser).not.toHaveBeenCalled();
  });

  it("strips email from an existing token and drops tokens without an id", async () => {
    const deps = makeDeps();
    expect(
      await jwtCallback(deps, {
        token: { uid: "u1", name: "Mina", email: "mina@example.com" },
      }),
    ).toEqual({ uid: "u1", name: "Mina" });
    expect(await jwtCallback(deps, { token: { name: "x" } })).toBeNull();
    expect(deps.upsertUser).not.toHaveBeenCalled();
  });
});

describe("sessionCallback", () => {
  it("returns exactly SessionUser with no email", () => {
    const session = sessionCallback({
      session: {
        expires: "2030-01-01T00:00:00.000Z",
        // The default session Auth.js builds includes the email.
        user: {
          id: "u1",
          name: "Mina",
          image: null,
          email: "mina@example.com",
        } as never,
      },
      token: {
        uid: "u1",
        name: "Mina",
        picture: "https://img.example/a.png",
        email: "mina@example.com",
      },
    });
    expect(session).toEqual({
      expires: "2030-01-01T00:00:00.000Z",
      user: { id: "u1", name: "Mina", image: "https://img.example/a.png" },
    });
    expect(Object.keys(session.user).sort()).toEqual(["id", "image", "name"]);
    expect(JSON.stringify(session)).not.toContain("email");
    expect(JSON.stringify(session)).not.toContain("@");
  });

  it("uses null for a missing image", () => {
    expect(toSessionUser({ uid: "u1", name: "Mina" })).toEqual({
      id: "u1",
      name: "Mina",
      image: null,
    });
  });
});

// @vitest-environment node
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { ProviderProfile } from "./auth/types";
import { createDb, type Db } from "./db/client";
import { runMigrations } from "./db/migrate";
import { users } from "./db/schema";
import { getPublicUser, upsertUserFromProvider } from "./users";

const profile: ProviderProfile = {
  provider: "google",
  providerAccountId: "g-123",
  name: "  Mina Park  ",
  image: "https://example.com/mina.png",
  email: "mina@example.com",
};

describe("users", () => {
  let db: Db;

  beforeEach(async () => {
    db = createDb({ inMemory: true });
    await runMigrations(db);
  });

  afterEach(async () => {
    await db.$client.close();
  });

  it("creates a member on first sign-in", async () => {
    const user = await upsertUserFromProvider(db, profile);

    expect(user).toEqual({
      id: expect.any(String),
      displayName: "Mina Park",
      avatarUrl: "https://example.com/mina.png",
    });
    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row?.email).toBe("mina@example.com");
    expect(row?.isBanned).toBe(false);
  });

  it("updates name and photo on a later sign-in but keeps id and created_at", async () => {
    const first = await upsertUserFromProvider(db, profile);
    const [before] = await db
      .select()
      .from(users)
      .where(eq(users.id, first.id));

    const second = await upsertUserFromProvider(
      db,
      { ...profile, name: "Mina P.", image: null, email: "new@example.com" },
      { id: "ignored-on-update" },
    );

    expect(second).toEqual({
      id: first.id,
      displayName: "Mina P.",
      avatarUrl: null,
    });
    const rows = await db.select().from(users);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.createdAt).toEqual(before?.createdAt);
    expect(rows[0]?.email).toBe("new@example.com");
    expect(rows[0]!.updatedAt.getTime()).toBeGreaterThanOrEqual(
      before!.updatedAt.getTime(),
    );
  });

  it("uses the provided id on creation", async () => {
    const user = await upsertUserFromProvider(
      db,
      { ...profile, provider: "dev", providerAccountId: "dev-mina" },
      { id: "dev-mina" },
    );
    expect(user.id).toBe("dev-mina");
  });

  it("falls back to Member for a blank name", async () => {
    const user = await upsertUserFromProvider(db, { ...profile, name: "   " });
    expect(user.displayName).toBe("Member");
  });

  it("never returns email", async () => {
    const created = await upsertUserFromProvider(db, profile);
    const fetched = await getPublicUser(db, created.id);

    expect(created).not.toHaveProperty("email");
    expect(fetched).not.toHaveProperty("email");
    expect(fetched).toEqual(created);
  });

  it("returns null for an unknown id", async () => {
    expect(await getPublicUser(db, "nope")).toBeNull();
  });
});

// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";

import { createDb, type Db } from "./client";
import { runMigrations } from "./migrate";

describe("database", () => {
  let db: Db | undefined;

  afterEach(async () => {
    await db?.$client.close();
    db = undefined;
  });

  it("applies all migrations to an in-memory database", async () => {
    db = createDb({ inMemory: true });
    await runMigrations(db);

    const rows = await db.execute(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    expect(rows.rows).toEqual([{ count: 2 }]);
  });

  it("is idempotent when migrations run twice", async () => {
    db = createDb({ inMemory: true });
    await runMigrations(db);
    await runMigrations(db);

    const rows = await db.execute(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    expect(rows.rows).toEqual([{ count: 2 }]);
  });

  // Regression: PGlite only creates the last folder, so a fresh clone without
  // `.data/` failed with ENOENT on first sign-in.
  it("creates missing parent folders for an on-disk database", async () => {
    const root = await mkdtemp(join(tmpdir(), "lm-db-"));
    try {
      db = createDb({ dataDir: join(root, "nested", "pglite") });
      await runMigrations(db);
      const rows = await db.execute(sql`select 1 as one`);
      expect(rows.rows).toEqual([{ one: 1 }]);
      await db.$client.close();
      db = undefined;
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("answers a simple query", async () => {
    db = createDb({ inMemory: true });
    const rows = await db.execute(sql`select 1 as one`);
    expect(rows.rows).toEqual([{ one: 1 }]);
  });
});

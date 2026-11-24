// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { sql } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createDb, openDb, type Db } from "./client";
import { DatabaseDamagedError, DatabaseLockedError } from "./errors";
import { lockFileFor } from "./lock";
import { runMigrations } from "./migrate";

// Every migration drizzle-kit generated, so adding one never breaks this test.
const MIGRATION_COUNT = (
  JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8")) as {
    entries: unknown[];
  }
).entries.length;

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
    expect(rows.rows).toEqual([{ count: MIGRATION_COUNT }]);
  });

  it("is idempotent when migrations run twice", async () => {
    db = createDb({ inMemory: true });
    await runMigrations(db);
    await runMigrations(db);

    const rows = await db.execute(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    expect(rows.rows).toEqual([{ count: MIGRATION_COUNT }]);
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

  describe("on disk", () => {
    let root: string;
    beforeEach(async () => {
      root = await mkdtemp(join(tmpdir(), "lm-db-"));
    });
    afterEach(async () => {
      await rm(root, { recursive: true, force: true });
    });

    it("refuses a second open of the same folder until the first closes", async () => {
      const dataDir = join(root, "pglite");
      db = await openDb({ dataDir });
      expect(existsSync(lockFileFor(dataDir))).toBe(true);
      expect(() => createDb({ dataDir })).toThrow(DatabaseLockedError);

      await db.$client.close();
      db = undefined;
      expect(existsSync(lockFileFor(dataDir))).toBe(false);

      db = await openDb({ dataDir });
      const rows = await db.execute(sql`select 1 as one`);
      expect(rows.rows).toEqual([{ one: 1 }]);
    });

    it("reports a damaged folder with an actionable error and frees it", async () => {
      const dataDir = join(root, "pglite");
      const first = await openDb({ dataDir });
      await first.$client.close();
      // Wreck pg_control, as an overlapping second process effectively does.
      const file = await open(join(dataDir, "global", "pg_control"), "r+");
      await file.write(Buffer.alloc(512), 0, 512, 0);
      await file.close();

      const error = await openDb({ dataDir }).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(DatabaseDamagedError);
      expect((error as Error).message).toContain(
        `Local database at ${dataDir} is damaged`,
      );
      expect(existsSync(lockFileFor(dataDir))).toBe(false);
    });
  });
});

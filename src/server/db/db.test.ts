// @vitest-environment node
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

  it("applies the init migration to an in-memory database", async () => {
    db = createDb({ inMemory: true });
    await runMigrations(db);

    const rows = await db.execute(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    expect(rows.rows).toEqual([{ count: 1 }]);
  });

  it("is idempotent when migrations run twice", async () => {
    db = createDb({ inMemory: true });
    await runMigrations(db);
    await runMigrations(db);

    const rows = await db.execute(
      sql`select count(*)::int as count from drizzle.__drizzle_migrations`,
    );
    expect(rows.rows).toEqual([{ count: 1 }]);
  });

  it("answers a simple query", async () => {
    db = createDb({ inMemory: true });
    const rows = await db.execute(sql`select 1 as one`);
    expect(rows.rows).toEqual([{ one: 1 }]);
  });
});

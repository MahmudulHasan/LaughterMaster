import { getSharedDb, type Db } from "./client";
import { runMigrations } from "./migrate";

// TODO: add `import "server-only"` once the package is installed.

let migrated: Promise<void> | undefined;

/**
 * The shared app database, opened once per process (see `getSharedDb`) with
 * all migrations applied before first use. Server code (auth, pages, actions,
 * route handlers) should call this. If opening or migrating fails, the next
 * call retries. A damaged or already-open folder rejects with
 * `DatabaseDamagedError` or `DatabaseLockedError` (see `errors.ts`).
 */
export async function getReadyDb(): Promise<Db> {
  const db = await getSharedDb();
  migrated ??= runMigrations(db).catch((error: unknown) => {
    migrated = undefined;
    throw error;
  });
  await migrated;
  return db;
}

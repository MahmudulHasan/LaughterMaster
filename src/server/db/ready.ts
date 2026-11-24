import {
  getSharedDb,
  hostedDatabaseUrl,
  type Db,
  type PgliteDb,
} from "./client";
import { runMigrations } from "./migrate";

// TODO: add `import "server-only"` once the package is installed.

let migrated: Promise<void> | undefined;

/**
 * The shared app database, opened once per process (see `getSharedDb`) with
 * all migrations applied before first use. Server code (auth, pages, actions,
 * route handlers) should call this. If opening or migrating fails, the next
 * call retries. A damaged or already-open folder rejects with
 * `DatabaseDamagedError` or `DatabaseLockedError` (see `errors.ts`).
 *
 * Hosted Postgres is migrated by the deploy (`npm run db:migrate`), so only
 * the local PGlite database migrates here.
 */
export async function getReadyDb(): Promise<Db> {
  const db = await getSharedDb();
  if (hostedDatabaseUrl()) return db;
  migrated ??= runMigrations(db as PgliteDb).catch((error: unknown) => {
    migrated = undefined;
    throw error;
  });
  await migrated;
  return db;
}

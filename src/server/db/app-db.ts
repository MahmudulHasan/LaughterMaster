import { getDb, type Db } from "./client";
import { runMigrations } from "./migrate";

let migrated: Promise<void> | undefined;

/** The shared app DB, migrated once before its first use. */
export async function getAppDb(): Promise<Db> {
  const db = getDb();
  migrated ??= runMigrations(db).catch((error: unknown) => {
    migrated = undefined; // let the next caller retry
    throw error;
  });
  await migrated;
  return db;
}

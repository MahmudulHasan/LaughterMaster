import path from "node:path";

import { migrate as migrateHosted } from "drizzle-orm/node-postgres/migrator";
import { migrate } from "drizzle-orm/pglite/migrator";

import type { PgliteDb } from "./client";
import { openHostedDb } from "./hosted";

/**
 * Absolute path to the generated migrations folder (`<repo>/drizzle`).
 * Resolved from the project root (process.cwd()), which is where Next.js,
 * Vitest and drizzle-kit all run. (import.meta.url is avoided because
 * Next.js bundling relocates server modules.)
 */
export function migrationsFolder(): string {
  return path.resolve(process.cwd(), "drizzle");
}

/** Apply all pending migrations from `drizzle/` to a PGlite database. */
export async function runMigrations(db: PgliteDb): Promise<void> {
  await migrate(db, { migrationsFolder: migrationsFolder() });
}

/**
 * Apply pending migrations to hosted Postgres. Runs once per deploy from the
 * Vercel build (`npm run db:migrate`), not at server start, so parallel
 * serverless instances never race to migrate.
 */
export async function runHostedMigrations(
  connectionString: string,
): Promise<void> {
  const db = openHostedDb(connectionString);
  try {
    await migrateHosted(db, { migrationsFolder: migrationsFolder() });
  } finally {
    await db.$client.end();
  }
}

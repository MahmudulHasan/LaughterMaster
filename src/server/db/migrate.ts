import path from "node:path";

import { migrate } from "drizzle-orm/pglite/migrator";

import type { Db } from "./client";

/**
 * Absolute path to the generated migrations folder (`<repo>/drizzle`).
 * Resolved from the project root (process.cwd()), which is where Next.js,
 * Vitest and drizzle-kit all run. (import.meta.url is avoided because
 * Next.js bundling relocates server modules.)
 */
export function migrationsFolder(): string {
  return path.resolve(process.cwd(), "drizzle");
}

/** Apply all pending migrations from `drizzle/` to the given database. */
export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: migrationsFolder() });
}

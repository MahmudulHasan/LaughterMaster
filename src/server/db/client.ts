import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import * as schema from "./schema";

// TODO: add `import "server-only"` once the package is installed.

export type Schema = typeof schema;
export type Db = PgliteDatabase<Schema> & { $client: PGlite };

export const DEFAULT_PGLITE_DATA_DIR = "./.data/pglite";

export interface CreateDbOptions {
  /** Keep the database in memory (for tests). Defaults to false. */
  inMemory?: boolean;
  /** On-disk data directory. Defaults to PGLITE_DATA_DIR or ./.data/pglite. */
  dataDir?: string;
}

/**
 * Create a Drizzle client backed by PGlite.
 *
 * Callers depend on the `Db` type, not on PGlite, so swapping to hosted
 * Postgres in M9 should only change this factory.
 */
export function createDb(options: CreateDbOptions = {}): Db {
  const client = options.inMemory
    ? new PGlite()
    : new PGlite(
        options.dataDir ??
          process.env.PGLITE_DATA_DIR ??
          DEFAULT_PGLITE_DATA_DIR,
      );
  return drizzle({ client, schema });
}

let sharedDb: Db | undefined;

/** Lazily created shared client for app code. */
export function getDb(): Db {
  sharedDb ??= createDb();
  return sharedDb;
}

import { mkdirSync } from "node:fs";

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";

import { toOpenError } from "./errors";
import { acquireDataDirLock, type LockDeps } from "./lock";
import { registerShutdownHooks } from "./shutdown";
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
  /** Test seam for the single-process lock. */
  lockDeps?: LockDeps;
}

export function resolveDataDir(dataDir?: string): string {
  return dataDir ?? process.env.PGLITE_DATA_DIR ?? DEFAULT_PGLITE_DATA_DIR;
}

/**
 * Create a Drizzle client backed by PGlite.
 *
 * Callers depend on the `Db` type, not on PGlite, so swapping to hosted
 * Postgres in M9 should only change this factory.
 *
 * On disk, only one process may open a folder at a time (see `lock.ts`):
 * this throws `DatabaseLockedError` if another live process holds it.
 * `db.$client.close()` releases the lock. PGlite starts in the background;
 * use `openDb` (or `getReadyDb` in app code) to wait for it and get a clear
 * `DatabaseDamagedError` if the folder can't be opened.
 */
export function createDb(options: CreateDbOptions = {}): Db {
  return createDbWithLock(options).db;
}

interface LockedDb {
  db: Db;
  /** Remove the lock file synchronously (for the `exit` event). */
  releaseLock: () => void;
}

function createDbWithLock(options: CreateDbOptions): LockedDb {
  if (options.inMemory) {
    return { db: drizzle({ client: new PGlite(), schema }), releaseLock() {} };
  }
  const dataDir = resolveDataDir(options.dataDir);
  // PGlite creates only the last folder, so a fresh clone (no `.data/`) fails
  // with ENOENT unless the parents exist.
  mkdirSync(dataDir, { recursive: true });
  const release = acquireDataDirLock(dataDir, options.lockDeps);
  let client: PGlite;
  try {
    client = new PGlite(dataDir);
  } catch (error) {
    release();
    throw toOpenError(dataDir, error);
  }
  const close = client.close.bind(client);
  client.close = async () => {
    try {
      await close();
    } finally {
      release();
    }
  };
  // If startup fails, free the folder so a retry (or another process) can
  // open it once it is fixed.
  client.waitReady.catch(() => release());
  return { db: drizzle({ client, schema }), releaseLock: release };
}

/**
 * `createDb`, then wait until PGlite has started. Startup failures become
 * actionable errors (`DatabaseDamagedError`) instead of a WASM `Aborted()`.
 */
export async function openDb(options: CreateDbOptions = {}): Promise<Db> {
  return (await openDbWithLock(options)).db;
}

async function openDbWithLock(options: CreateDbOptions): Promise<LockedDb> {
  const locked = createDbWithLock(options);
  try {
    await locked.db.$client.waitReady;
  } catch (error) {
    throw toOpenError(
      options.inMemory ? "(in memory)" : resolveDataDir(options.dataDir),
      error,
    );
  }
  return locked;
}

// Kept on globalThis so a dev-server module reload reuses the open client
// instead of opening the same folder a second time in the same process.
interface SharedDbState {
  db?: Promise<Db>;
  unregisterShutdown?: () => void;
}
const globalKey = Symbol.for("laughtermaster.sharedDb");
function sharedState(): SharedDbState {
  const g = globalThis as { [globalKey]?: SharedDbState };
  return (g[globalKey] ??= {});
}

/**
 * The shared client for app code, opened once per process, with shutdown
 * hooks that close it on SIGINT/SIGTERM/beforeExit. If opening fails, the
 * next call tries again.
 */
export function getSharedDb(): Promise<Db> {
  const state = sharedState();
  state.db ??= openDbWithLock({}).then(
    ({ db, releaseLock }) => {
      state.unregisterShutdown = registerShutdownHooks({
        close: () => db.$client.close(),
        // The process is exiting before close finished; at least free the
        // folder (Postgres recovers from the unclean stop on next start).
        onExit: releaseLock,
      });
      return db;
    },
    (error: unknown) => {
      state.db = undefined;
      throw error;
    },
  );
  return state.db;
}

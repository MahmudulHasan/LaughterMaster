import {
  openSync,
  readFileSync,
  unlinkSync,
  writeSync,
  closeSync,
} from "node:fs";
import path from "node:path";

import { DatabaseLockedError } from "./errors";

/**
 * Single-process guard for an on-disk PGlite folder.
 *
 * PGlite runs Postgres inside WASM with a fake pid (-42), so Postgres' own
 * `postmaster.pid` check never stops a second process. Two processes on one
 * folder each keep their own WAL position; when one of them restarts on the
 * folder it writes a checkpoint that the other then overwrites, and the next
 * start PANICs with "could not locate a valid checkpoint record" (seen as
 * `RuntimeError: Aborted()`). This lock turns that into a clear error.
 *
 * The lock file sits next to the folder (`<dataDir>.lock`), not inside it,
 * so it never interferes with initdb on a fresh folder.
 */

export interface LockDeps {
  pid: number;
  /** True if a process with this pid is running. */
  isAlive: (pid: number) => boolean;
}

export const defaultLockDeps: LockDeps = {
  pid: process.pid,
  isAlive(pid) {
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      // EPERM: it exists but belongs to another user.
      return (error as NodeJS.ErrnoException).code === "EPERM";
    }
  },
};

export function lockFileFor(dataDir: string): string {
  return `${path.resolve(dataDir)}.lock`;
}

function readOwner(lockFile: string): number | undefined {
  try {
    const pid = Number.parseInt(readFileSync(lockFile, "utf8"), 10);
    return Number.isInteger(pid) && pid > 0 ? pid : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Take the lock for `dataDir` or throw `DatabaseLockedError`. A lock left by
 * a process that no longer runs is taken over. Returns a release function
 * that is safe to call more than once.
 */
export function acquireDataDirLock(
  dataDir: string,
  deps: LockDeps = defaultLockDeps,
): () => void {
  const lockFile = lockFileFor(dataDir);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(lockFile, "wx");
      try {
        writeSync(fd, `${deps.pid}\n`);
      } finally {
        closeSync(fd);
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        if (readOwner(lockFile) === deps.pid) {
          try {
            unlinkSync(lockFile);
          } catch {
            // Already gone.
          }
        }
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    const owner = readOwner(lockFile);
    if (owner !== undefined && deps.isAlive(owner)) {
      // Includes owner === our pid: a second instance in the same process
      // (e.g. a module reloaded by the dev server) is just as harmful.
      throw new DatabaseLockedError(dataDir, lockFile, owner);
    }
    // Stale (owner gone or unreadable): remove and retry once.
    try {
      unlinkSync(lockFile);
    } catch {
      // Someone else removed it first; the retry decides.
    }
  }
  throw new DatabaseLockedError(dataDir, lockFile, readOwner(lockFile) ?? -1);
}

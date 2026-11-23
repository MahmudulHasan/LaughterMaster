// @vitest-environment node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { DatabaseLockedError } from "./errors";
import { acquireDataDirLock, lockFileFor, type LockDeps } from "./lock";

describe("data directory lock", () => {
  let root: string;
  let dataDir: string;
  const alive = new Set<number>();
  const deps = (pid: number): LockDeps => ({
    pid,
    isAlive: (p) => alive.has(p),
  });

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "lm-lock-"));
    dataDir = join(root, "pglite");
    alive.clear();
  });
  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes the owner pid next to the folder and removes it on release", () => {
    const release = acquireDataDirLock(dataDir, deps(100));
    expect(readFileSync(lockFileFor(dataDir), "utf8").trim()).toBe("100");
    release();
    release(); // idempotent
    expect(existsSync(lockFileFor(dataDir))).toBe(false);
  });

  it("refuses a second owner while the first is alive", () => {
    alive.add(100);
    acquireDataDirLock(dataDir, deps(100));
    expect(() => acquireDataDirLock(dataDir, deps(200))).toThrow(
      DatabaseLockedError,
    );
    // A second open in the same process is refused too.
    expect(() => acquireDataDirLock(dataDir, deps(100))).toThrow(/pid 100/);
  });

  it("takes over a lock left by a process that has exited", () => {
    writeFileSync(lockFileFor(dataDir), "100\n");
    const release = acquireDataDirLock(dataDir, deps(200));
    expect(readFileSync(lockFileFor(dataDir), "utf8").trim()).toBe("200");
    release();
  });

  it("takes over an unreadable lock file", () => {
    writeFileSync(lockFileFor(dataDir), "garbage");
    acquireDataDirLock(dataDir, deps(200))();
  });

  it("does not remove a lock that another process has taken over", () => {
    const release = acquireDataDirLock(dataDir, deps(100));
    writeFileSync(lockFileFor(dataDir), "300\n");
    release();
    expect(readFileSync(lockFileFor(dataDir), "utf8").trim()).toBe("300");
  });
});

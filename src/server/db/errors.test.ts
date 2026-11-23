// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  DatabaseDamagedError,
  DatabaseLockedError,
  isWasmAbort,
  toOpenError,
} from "./errors";

function wasmAbort(): Error {
  return new WebAssembly.RuntimeError(
    "Aborted(). Build with -sASSERTIONS for more info.",
  );
}

describe("database open errors", () => {
  it("recognises PGlite's WASM abort", () => {
    expect(isWasmAbort(wasmAbort())).toBe(true);
    expect(isWasmAbort(new Error("Aborted()"))).toBe(false);
    expect(isWasmAbort(new WebAssembly.RuntimeError("unreachable"))).toBe(
      false,
    );
    expect(isWasmAbort("Aborted()")).toBe(false);
  });

  it("turns an abort into an actionable damaged-database error", () => {
    const cause = wasmAbort();
    const error = toOpenError(".data/pglite", cause);

    expect(error).toBeInstanceOf(DatabaseDamagedError);
    const damaged = error as DatabaseDamagedError;
    expect(damaged.cause).toBe(cause);
    expect(damaged.dataDir).toBe(".data/pglite");
    expect(damaged.message).toContain(
      "Local database at .data/pglite is damaged",
    );
    expect(damaged.message).toContain("mv .data/pglite .data/pglite-broken");
  });

  it("treats a Postgres startup failure as damage too", () => {
    const error = toOpenError(
      "d",
      new Error("PGlite failed to initialize properly"),
    );
    expect(error).toBeInstanceOf(DatabaseDamagedError);
  });

  it("passes other errors through unchanged", () => {
    const other = new Error("EACCES");
    expect(toOpenError(".data/pglite", other)).toBe(other);
    const locked = new DatabaseLockedError("d", "d.lock", 123);
    expect(toOpenError("d", locked)).toBe(locked);
  });

  it("names the owner and the lock file when the folder is in use", () => {
    const error = new DatabaseLockedError(
      ".data/pglite",
      "/x/.data/pglite.lock",
      4242,
    );
    expect(error.message).toContain("pid 4242");
    expect(error.message).toContain("delete /x/.data/pglite.lock");
  });
});

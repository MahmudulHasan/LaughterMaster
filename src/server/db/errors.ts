/**
 * Errors for opening the local PGlite database, with messages that say what
 * to do instead of PGlite's raw WASM `Aborted()`.
 */

/** Another live process already has this data directory open. */
export class DatabaseLockedError extends Error {
  override name = "DatabaseLockedError";

  constructor(
    readonly dataDir: string,
    readonly lockFile: string,
    readonly ownerPid: number,
  ) {
    super(
      `Local database at ${dataDir} is already open in another process ` +
        `(pid ${ownerPid}). PGlite allows only one process per folder, and a ` +
        `second one corrupts it. Stop the other process (another \`next dev\`, ` +
        `\`next build\`, or \`npm run db:seed\`) and try again. If no such ` +
        `process is running, delete ${lockFile}.`,
    );
  }
}

/** The data directory exists but PGlite could not start on it. */
export class DatabaseDamagedError extends Error {
  override name = "DatabaseDamagedError";

  constructor(
    readonly dataDir: string,
    options: { cause: unknown },
  ) {
    super(
      `Local database at ${dataDir} is damaged and cannot be opened. ` +
        `Stop the dev server, move the folder aside ` +
        `(e.g. mv ${dataDir} ${dataDir}-broken), and restart; it will be ` +
        `recreated empty (run \`npm run db:seed\` for sample data).`,
      options,
    );
  }
}

/**
 * PGlite reports a Postgres PANIC (e.g. "could not locate a valid checkpoint
 * record") as an Emscripten `RuntimeError: Aborted()`.
 */
export function isWasmAbort(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "RuntimeError" ||
      error.constructor.name === "RuntimeError") &&
    error.message.startsWith("Aborted(")
  );
}

/** PGlite's error when Postgres exits during startup (e.g. bad pg_control). */
function isStartupFailure(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message === "PGlite failed to initialize properly"
  );
}

/** Turn a failure while opening `dataDir` into an actionable error. */
export function toOpenError(dataDir: string, error: unknown): unknown {
  if (error instanceof DatabaseLockedError) return error;
  if (isWasmAbort(error) || isStartupFailure(error)) {
    return new DatabaseDamagedError(dataDir, { cause: error });
  }
  return error;
}

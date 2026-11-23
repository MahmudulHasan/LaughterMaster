/**
 * Close the shared on-disk PGlite when the process stops.
 *
 * Postgres recovers from an unclean stop (tested with SIGKILL), so this is
 * not what keeps the data safe — the lock in `lock.ts` is. Closing cleanly
 * still skips crash recovery on the next start and removes the lock file
 * right away instead of leaving a stale one.
 */

export type ShutdownSignal = "SIGINT" | "SIGTERM";

/** The slice of `process` this module uses, so tests can pass a fake. */
export interface ShutdownProcess {
  on(event: string, listener: (...args: unknown[]) => void): unknown;
  off(event: string, listener: (...args: unknown[]) => void): unknown;
  listenerCount(event: string): number;
  kill(pid: number, signal: ShutdownSignal): unknown;
  pid: number;
}

export interface ShutdownHooks {
  /** Close the database. Called at most once. */
  close: () => Promise<void>;
  /** Synchronous last resort on `exit` (e.g. remove the lock file). */
  onExit: () => void;
  /** Give up waiting for close after this many ms. Default 3000. */
  timeoutMs?: number;
}

const SIGNALS: readonly ShutdownSignal[] = ["SIGINT", "SIGTERM"];

/**
 * Register handlers for SIGINT, SIGTERM, beforeExit and exit. Returns a
 * function that removes them.
 *
 * On a signal the database is closed first. If nothing else listens for that
 * signal (plain Node scripts), it is re-raised so the process still stops
 * the default way; when Next.js has its own handler, Next decides when to
 * exit.
 */
export function registerShutdownHooks(
  hooks: ShutdownHooks,
  proc: ShutdownProcess = process,
): () => void {
  const timeoutMs = hooks.timeoutMs ?? 3000;
  let closing: Promise<void> | undefined;

  const closeOnce = (): Promise<void> => {
    closing ??= Promise.race([
      hooks.close().catch(() => {
        // Nothing useful to do while stopping; recovery handles the rest.
      }),
      new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, timeoutMs);
        timer.unref?.();
      }),
    ]);
    return closing;
  };

  const signalHandlers = new Map<ShutdownSignal, () => void>();
  for (const signal of SIGNALS) {
    const handler = () => {
      void closeOnce().then(() => {
        unregister();
        if (proc.listenerCount(signal) === 0) proc.kill(proc.pid, signal);
      });
    };
    signalHandlers.set(signal, handler);
    proc.on(signal, handler);
  }

  const beforeExit = () => {
    void closeOnce();
  };
  const exit = () => {
    hooks.onExit();
  };
  proc.on("beforeExit", beforeExit);
  proc.on("exit", exit);

  let registered = true;
  function unregister() {
    if (!registered) return;
    registered = false;
    for (const [signal, handler] of signalHandlers) proc.off(signal, handler);
    proc.off("beforeExit", beforeExit);
    // `exit` stays until the process ends so the lock is always released.
  }

  return () => {
    unregister();
    proc.off("exit", exit);
  };
}

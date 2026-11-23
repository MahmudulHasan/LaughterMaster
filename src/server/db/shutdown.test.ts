// @vitest-environment node
import { EventEmitter } from "node:events";

import { describe, expect, it, vi } from "vitest";

import { registerShutdownHooks, type ShutdownProcess } from "./shutdown";

function fakeProcess() {
  const emitter = new EventEmitter();
  const kill = vi.fn();
  const proc: ShutdownProcess & { emit: EventEmitter["emit"] } = {
    pid: 4242,
    on: (event, listener) => emitter.on(event, listener),
    off: (event, listener) => emitter.off(event, listener),
    listenerCount: (event) => emitter.listenerCount(event),
    emit: emitter.emit.bind(emitter),
    kill,
  };
  return { proc, kill, emitter };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("database shutdown hooks", () => {
  it("registers SIGINT, SIGTERM, beforeExit and exit handlers", () => {
    const { emitter, proc } = fakeProcess();
    const unregister = registerShutdownHooks(
      { close: vi.fn(async () => {}), onExit: vi.fn() },
      proc,
    );
    for (const event of ["SIGINT", "SIGTERM", "beforeExit", "exit"]) {
      expect(emitter.listenerCount(event)).toBe(1);
    }
    unregister();
    expect(emitter.eventNames()).toEqual([]);
  });

  it("closes once on a signal and re-raises it when nobody else handles it", async () => {
    const { proc, kill, emitter } = fakeProcess();
    const close = vi.fn(async () => {});
    registerShutdownHooks({ close, onExit: vi.fn() }, proc);

    proc.emit("SIGTERM");
    proc.emit("SIGINT");
    await flush();

    expect(close).toHaveBeenCalledTimes(1);
    expect(emitter.listenerCount("SIGTERM")).toBe(0);
    expect(kill).toHaveBeenCalledWith(4242, "SIGTERM");
    // `exit` stays registered so the lock is still released.
    expect(emitter.listenerCount("exit")).toBe(1);
  });

  it("leaves exiting to another handler (e.g. Next.js) when there is one", async () => {
    const { proc, kill } = fakeProcess();
    const close = vi.fn(async () => {});
    registerShutdownHooks({ close, onExit: vi.fn() }, proc);
    proc.on("SIGINT", () => {});

    proc.emit("SIGINT");
    await flush();

    expect(close).toHaveBeenCalledTimes(1);
    expect(kill).not.toHaveBeenCalled();
  });

  it("still re-raises when close fails or hangs", async () => {
    vi.useFakeTimers();
    try {
      const { proc, kill } = fakeProcess();
      registerShutdownHooks(
        { close: () => new Promise(() => {}), onExit: vi.fn(), timeoutMs: 50 },
        proc,
      );
      proc.emit("SIGINT");
      await vi.advanceTimersByTimeAsync(60);
      expect(kill).toHaveBeenCalledWith(4242, "SIGINT");
    } finally {
      vi.useRealTimers();
    }

    const { proc, kill } = fakeProcess();
    registerShutdownHooks(
      { close: () => Promise.reject(new Error("boom")), onExit: vi.fn() },
      proc,
    );
    proc.emit("SIGTERM");
    await flush();
    expect(kill).toHaveBeenCalledWith(4242, "SIGTERM");
  });

  it("closes on beforeExit and runs the sync hook on exit", async () => {
    const { proc } = fakeProcess();
    const close = vi.fn(async () => {});
    const onExit = vi.fn();
    registerShutdownHooks({ close, onExit }, proc);

    proc.emit("beforeExit");
    proc.emit("beforeExit");
    await flush();
    expect(close).toHaveBeenCalledTimes(1);

    proc.emit("exit");
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Unmount rendered trees between tests (no `globals: true`, so RTL can't auto-register this).
afterEach(() => {
  cleanup();
});

// Server Components call `connection()` to opt into request-time rendering;
// outside a real Next request it throws, so make it a no-op in component tests.
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: async () => {},
}));

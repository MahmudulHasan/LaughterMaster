import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

// Two projects, chosen by file extension:
// - `*.test.tsx` (React components) run in jsdom with Testing Library setup.
// - `*.test.ts` (server logic, e.g. PGlite-backed DB tests) run in plain node.
const exclude = [...configDefaults.exclude, "**/.next/**", "e2e/**"];

export default defineConfig({
  plugins: [react()],
  // Resolves the `@/*` alias from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: "dom",
          environment: "jsdom",
          include: ["**/*.test.tsx"],
          exclude,
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["**/*.test.ts"],
          exclude,
        },
      },
    ],
  },
});

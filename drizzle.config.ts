import { defineConfig } from "drizzle-kit";

// Local dev and tests use PGlite (embedded Postgres). Hosted Postgres arrives in M9.
export default defineConfig({
  dialect: "postgresql",
  driver: "pglite",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.PGLITE_DATA_DIR ?? "./.data/pglite",
  },
});

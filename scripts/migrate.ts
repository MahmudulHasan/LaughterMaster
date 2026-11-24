// Applies pending migrations from drizzle/. With DATABASE_URL set (Vercel +
// Neon) it migrates hosted Postgres; Vercel runs it before `next build`
// through the `vercel-build` script. Without it, it migrates the local PGlite
// folder (stop the dev server first).

import {
  hostedDatabaseUrl,
  openDb,
  resolveDataDir,
} from "../src/server/db/client";
import { runHostedMigrations, runMigrations } from "../src/server/db/migrate";

async function main() {
  // Neon's direct (unpooled) URL suits schema changes; fall back to the pooled one.
  const url = process.env.DATABASE_URL_UNPOOLED || hostedDatabaseUrl();
  if (url) {
    await runHostedMigrations(url);
    console.log("Migrated hosted Postgres.");
    return;
  }
  const db = await openDb({ dataDir: resolveDataDir() });
  try {
    await runMigrations(db);
    console.log(`Migrated local PGlite at ${resolveDataDir()}.`);
  } finally {
    await db.$client.close();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

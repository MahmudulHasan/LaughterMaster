// Retry job (SPEC US-11): moderates jokes left pending because Claude was
// unavailable. Run with `npm run moderate:pending` while the dev server is
// stopped (PGlite allows one process per data folder). In production this
// becomes a scheduled job (M9).

import { openDb, resolveDataDir } from "../src/server/db/client";
import {
  DatabaseDamagedError,
  DatabaseLockedError,
} from "../src/server/db/errors";
import { runMigrations } from "../src/server/db/migrate";
import { createModerator } from "../src/server/moderation/moderator";
import { moderatePendingJokes } from "../src/server/moderation/pipeline";

async function main() {
  const db = await openDb({ dataDir: resolveDataDir() });
  try {
    await runMigrations(db);
    const counts = await moderatePendingJokes(db, createModerator());
    console.log(
      `Moderated pending jokes: ${counts.approved} approved, ${counts.rejected} rejected, ${counts.pending} still pending, ${counts.skipped} skipped.`,
    );
  } finally {
    await db.$client.close();
  }
}

main().catch((error: unknown) => {
  if (
    error instanceof DatabaseLockedError ||
    error instanceof DatabaseDamagedError
  ) {
    console.error(`Moderation failed: ${error.message}`);
  } else {
    console.error(error);
  }
  process.exit(1);
});

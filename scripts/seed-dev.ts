// Dev seed: demo members and jokes for local testing (PLAN.md M4).
//
//   npm run db:seed
//
// Stop `npm run dev` first: PGlite allows one process per data folder, and a
// second one can corrupt it. Respects PGLITE_DATA_DIR (default ./.data/pglite).
// Safe to re-run: existing users are refreshed and existing jokes skipped.

import { count, inArray } from "drizzle-orm";

import { openDb, resolveDataDir } from "../src/server/db/client";
import {
  DatabaseDamagedError,
  DatabaseLockedError,
} from "../src/server/db/errors";
import { runMigrations } from "../src/server/db/migrate";
import { jokes } from "../src/server/db/schema";
import { upsertUserFromProvider } from "../src/server/users";
import { buildJokeRows, SEED_JOKES, SEED_USERS } from "./seed-data";

async function main(): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed: NODE_ENV is production.");
    process.exitCode = 1;
    return;
  }

  const dataDir = resolveDataDir();
  console.warn(
    "Warning: stop the dev server first. PGlite is single-process, and two processes on one data folder can corrupt it.",
  );
  console.log(`Seeding PGlite database at ${dataDir}`);

  // Throws DatabaseLockedError while `next dev` holds the folder.
  const db = await openDb({ dataDir });
  try {
    await runMigrations(db);
    console.log("Migrations applied.");

    // Same profile shape the dev sign-in uses (src/server/auth/session.ts).
    for (const user of SEED_USERS) {
      await upsertUserFromProvider(
        db,
        {
          provider: "dev",
          providerAccountId: user.id,
          name: user.name,
          image: null,
          email: null,
        },
        { id: user.id },
      );
    }
    console.log(`Users: ${SEED_USERS.length} dev users upserted.`);

    // Inserted directly so the per-day post limit and "now" don't apply.
    const inserted = await db
      .insert(jokes)
      .values(buildJokeRows(new Date()))
      .onConflictDoNothing({ target: jokes.id })
      .returning({ id: jokes.id });
    const skipped = SEED_JOKES.length - inserted.length;
    console.log(
      `Jokes: ${inserted.length} inserted, ${skipped} already present.`,
    );

    const [seeded] = await db
      .select({ value: count() })
      .from(jokes)
      .where(
        inArray(
          jokes.id,
          SEED_JOKES.map((joke) => joke.id),
        ),
      );
    const [total] = await db.select({ value: count() }).from(jokes);
    console.log(
      `Done. Seed jokes in database: ${seeded?.value ?? 0}; all jokes: ${total?.value ?? 0}.`,
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
    console.error(`Seeding failed: ${error.message}`);
  } else {
    console.error("Seeding failed:", error);
  }
  process.exitCode = 1;
});

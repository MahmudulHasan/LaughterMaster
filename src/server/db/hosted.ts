import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type HostedDb = NodePgDatabase<typeof schema> & { $client: Pool };

/**
 * Drizzle on node-postgres for hosted Postgres (Neon's pooled URL on
 * Vercel). Serverless instances are short-lived and many may run at once,
 * so each keeps a small pool and lets idle connections go quickly; Neon's
 * pooler handles the fan-in.
 */
export function openHostedDb(connectionString: string): HostedDb {
  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
  return drizzle({ client: pool, schema });
}

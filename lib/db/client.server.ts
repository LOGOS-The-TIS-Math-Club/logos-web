import "server-only";

import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";

import * as schema from "@/db/schema";
import { getRuntimeDatabaseEnvironment } from "@/lib/db/env.server";

/*
 * The pooled Neon driver needs a WebSocket implementation for transactions, and
 * `neonConfig.webSocketConstructor` is undefined by default.
 *
 * This project requires Node >= 24 (see package.json engines), which ships a
 * standards-compliant global WebSocket, so the platform's own implementation is
 * used rather than adding the `ws` package. Failing loudly here is better than
 * surfacing an opaque connection error on the first query.
 */
if (!neonConfig.webSocketConstructor) {
  if (typeof globalThis.WebSocket === "undefined") {
    throw new Error(
      "No WebSocket implementation available. Node 22+ is required for the Neon pooled driver.",
    );
  }
  neonConfig.webSocketConstructor =
    globalThis.WebSocket as unknown as typeof neonConfig.webSocketConstructor;
}

type Database = NeonDatabase<typeof schema>;

/**
 * Runs one operation with a request-scoped WebSocket pool. Neon requires
 * serverless WebSocket connections to close within the same request.
 */
export async function withDatabase<Result>(
  operation: (database: Database) => Promise<Result>,
): Promise<Result> {
  const { databaseUrl } = getRuntimeDatabaseEnvironment();
  const pool = new Pool({ connectionString: databaseUrl });
  const database = drizzle({ client: pool, schema });

  try {
    return await operation(database);
  } finally {
    await pool.end();
  }
}

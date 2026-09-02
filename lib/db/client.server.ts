import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import ws from "ws";

import * as schema from "@/db/schema";
import { getRuntimeDatabaseEnvironment } from "@/lib/db/env.server";

neonConfig.webSocketConstructor = ws;

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


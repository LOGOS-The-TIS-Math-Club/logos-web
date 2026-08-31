import path from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import {
  assertDatabaseEnvironmentIdentity,
  createSqlClient,
  requireEnvironmentVariable,
} from "./shared.mjs";

const migrationUrl = requireEnvironmentVariable("MIGRATION_DATABASE_URL");
const sql = createSqlClient("MIGRATION_DATABASE_URL");

try {
  await assertDatabaseEnvironmentIdentity(
    sql,
    "MIGRATION_DATABASE_URL",
    migrationUrl,
  );
  const database = drizzle(sql);
  const migrationsFolder = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../drizzle",
  );
  await migrate(database, { migrationsFolder });
  console.log("Database migrations applied successfully.");
} finally {
  await sql.end();
}

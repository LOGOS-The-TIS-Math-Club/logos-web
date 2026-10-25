import postgres from "postgres";
import { BackendError } from "./errors.ts";
let database: postgres.Sql | undefined;
export function getDatabase(): postgres.Sql {
  if (!database) {
    if (!process.env.DATABASE_URL)
      throw new BackendError("UNAVAILABLE", "Database is not configured.", 503);
    database = postgres(process.env.DATABASE_URL, {
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
    });
  }
  return database;
}

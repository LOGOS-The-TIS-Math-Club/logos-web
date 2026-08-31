import "server-only";

import { parseRuntimeDatabaseEnvironment } from "@/lib/db/database-env";

export function getRuntimeDatabaseEnvironment() {
  return parseRuntimeDatabaseEnvironment(process.env);
}

import {
  assertDatabaseEnvironmentIdentity,
  createSqlClient,
  requireEnvironmentVariable,
  requireNonProductionEnvironment,
} from "./shared.mjs";

requireNonProductionEnvironment();

const databaseUrl = requireEnvironmentVariable("DATABASE_URL");
const sql = createSqlClient("DATABASE_URL");

try {
  await assertDatabaseEnvironmentIdentity(sql, "DATABASE_URL", databaseUrl);
  await sql`
    insert into logos.infrastructure_probe (id, marker, updated_at)
    values (1, 'logos-phase-02-synthetic', now())
    on conflict (id) do update
    set marker = excluded.marker, updated_at = excluded.updated_at
  `;
  console.log("Synthetic Phase 02 fixture loaded.");
} finally {
  await sql.end();
}

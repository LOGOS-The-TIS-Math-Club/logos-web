import {
  assertDatabaseEnvironmentIdentity,
  createSqlClient,
  parsePostgresUrl,
  requireEnvironmentVariable,
  requireNonProductionEnvironment,
} from "./shared.mjs";

const appEnvironment = requireNonProductionEnvironment();
if (appEnvironment !== "test") {
  throw new Error("Test role provisioning requires APP_ENV=test");
}

const testDatabaseUrl = requireEnvironmentVariable("TEST_DATABASE_URL");
const target = parsePostgresUrl("TEST_DATABASE_URL", testDatabaseUrl);
if (!target.isLocal) {
  throw new Error("Test role provisioning requires a local database");
}

const sql = createSqlClient("TEST_DATABASE_URL");
try {
  await assertDatabaseEnvironmentIdentity(
    sql,
    "TEST_DATABASE_URL",
    testDatabaseUrl,
  );
  await sql`
    do $$
    begin
      if not exists (select from pg_roles where rolname = 'logos_ci_runtime') then
        create role logos_ci_runtime
          login nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
      end if;
      if not exists (select from pg_roles where rolname = 'logos_ci_backup') then
        create role logos_ci_backup
          login nosuperuser nocreatedb nocreaterole noinherit nobypassrls;
      end if;
    end
    $$
  `;
  await sql`
    alter role logos_ci_runtime
      login nosuperuser nocreatedb nocreaterole inherit nobypassrls
  `;
  await sql`
    alter role logos_ci_backup
      login nosuperuser nocreatedb nocreaterole inherit nobypassrls
  `;
  await sql`grant logos_runtime to logos_ci_runtime with inherit true, set false`;
  await sql`grant logos_backup to logos_ci_backup with inherit true, set false`;
  console.log("Unprivileged test login roles provisioned.");
} finally {
  await sql.end();
}

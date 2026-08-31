import {
  assertDatabaseIdentity,
  createSqlClient,
  parsePostgresUrl,
  requireEnvironmentVariable,
  requireNonProductionEnvironment,
} from "./shared.mjs";

const appEnvironment = requireNonProductionEnvironment();
if (appEnvironment !== "test") {
  throw new Error("Test database configuration requires APP_ENV=test");
}

const testDatabaseUrl = requireEnvironmentVariable("TEST_DATABASE_URL");
const target = parsePostgresUrl("TEST_DATABASE_URL", testDatabaseUrl);
if (!target.isLocal) {
  throw new Error("Test database configuration requires a local database");
}

const sql = createSqlClient("TEST_DATABASE_URL");
try {
  await assertDatabaseIdentity(sql, "TEST_DATABASE_URL", testDatabaseUrl);
  await sql`
    do $$
    begin
      execute format(
        'comment on database %I is %L',
        current_database(),
        'logos.app_environment=test'
      );
    end
    $$
  `;
  console.log("Test database environment identity configured.");
} finally {
  await sql.end();
}

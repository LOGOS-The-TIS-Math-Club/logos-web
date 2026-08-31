const hostDatabaseUrl = new URL(`${"postgresql:"}//127.0.0.1`);
hostDatabaseUrl.username = "postgres";
hostDatabaseUrl.port = "5432";
hostDatabaseUrl.pathname = "/logos_web_test";
hostDatabaseUrl.searchParams.set("sslmode", "disable");

const runtimeDatabaseUrl = new URL(hostDatabaseUrl);
runtimeDatabaseUrl.username = "logos_ci_runtime";

const backupDatabaseUrl = new URL(hostDatabaseUrl);
backupDatabaseUrl.username = "logos_ci_backup";

const containerDatabaseUrl = new URL(hostDatabaseUrl);
containerDatabaseUrl.hostname = "127.0.0.1";

const variables = {
  APP_ENV: "test",
  APP_URL: "http://localhost:3000",
  BACKUP_DATABASE_URL: backupDatabaseUrl.toString(),
  CSRF_SIGNING_SECRET:
    "a_super_secret_test_key_at_least_32_bytes_long_123456789!",
  DATABASE_URL: runtimeDatabaseUrl.toString(),
  MIGRATION_DATABASE_URL: hostDatabaseUrl.toString(),
  POSTGRES_CONTAINER_BACKUP_DATABASE_URL: backupDatabaseUrl.toString(),
  POSTGRES_CONTAINER_DATABASE_URL: containerDatabaseUrl.toString(),
  POSTGRES_TOOLS_CONTAINER: "logos-phase02-ci-db",
  RATE_LIMIT_SECRET: "a_super_secret_rate_limit_key_of_32_bytes_len_123456789!",
  TEST_DATABASE_URL: hostDatabaseUrl.toString(),
  TRUSTED_ORIGINS: "http://localhost:3000",
};

for (const [name, value] of Object.entries(variables)) {
  process.stdout.write(`${name}=${value}\n`);
}

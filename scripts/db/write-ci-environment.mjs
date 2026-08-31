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
  BACKUP_DATABASE_URL: backupDatabaseUrl.toString(),
  DATABASE_URL: runtimeDatabaseUrl.toString(),
  MIGRATION_DATABASE_URL: hostDatabaseUrl.toString(),
  POSTGRES_CONTAINER_BACKUP_DATABASE_URL: backupDatabaseUrl.toString(),
  POSTGRES_CONTAINER_DATABASE_URL: containerDatabaseUrl.toString(),
  POSTGRES_TOOLS_CONTAINER: "logos-phase02-ci-db",
  TEST_DATABASE_URL: hostDatabaseUrl.toString(),
};

for (const [name, value] of Object.entries(variables)) {
  process.stdout.write(`${name}=${value}\n`);
}

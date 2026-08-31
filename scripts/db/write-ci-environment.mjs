const hostDatabaseUrl = new URL(`${"postgresql:"}//127.0.0.1`);
hostDatabaseUrl.username = "postgres";
hostDatabaseUrl.port = "5432";
hostDatabaseUrl.pathname = "/logos_web_test";
hostDatabaseUrl.searchParams.set("sslmode", "disable");

const runtimeDatabaseUrl = new URL(hostDatabaseUrl);
runtimeDatabaseUrl.searchParams.set("options", "-c role=logos_runtime");

const containerDatabaseUrl = new URL(hostDatabaseUrl);
containerDatabaseUrl.hostname = "127.0.0.1";

const variables = {
  APP_ENV: "test",
  DATABASE_URL: runtimeDatabaseUrl.toString(),
  MIGRATION_DATABASE_URL: hostDatabaseUrl.toString(),
  POSTGRES_CONTAINER_DATABASE_URL: containerDatabaseUrl.toString(),
  POSTGRES_TOOLS_CONTAINER: "logos-phase02-ci-db",
  TEST_DATABASE_URL: hostDatabaseUrl.toString(),
};

for (const [name, value] of Object.entries(variables)) {
  process.stdout.write(`${name}=${value}\n`);
}

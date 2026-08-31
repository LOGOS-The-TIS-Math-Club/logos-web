import postgres from "postgres";

const appEnvironments = new Set([
  "development",
  "preview",
  "test",
  "production",
]);
const allowedSyntheticEnvironments = new Set([
  "development",
  "preview",
  "test",
]);

export function requireEnvironmentVariable(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function requireAppEnvironment() {
  const appEnvironment = requireEnvironmentVariable("APP_ENV");
  if (!appEnvironments.has(appEnvironment)) {
    throw new Error("APP_ENV is not recognized");
  }
  return appEnvironment;
}

export function requireNonProductionEnvironment() {
  const appEnvironment = requireAppEnvironment();
  if (!allowedSyntheticEnvironments.has(appEnvironment)) {
    throw new Error("Synthetic database operations refuse this APP_ENV");
  }
  return appEnvironment;
}

export function parsePostgresUrl(name, value) {
  let parsedUrl;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }

  if (
    parsedUrl.protocol !== "postgres:" &&
    parsedUrl.protocol !== "postgresql:"
  ) {
    throw new Error(`${name} must be a valid PostgreSQL URL`);
  }

  const databaseName = parsedUrl.pathname.slice(1);
  if (!databaseName) {
    throw new Error(`${name} must identify a database`);
  }

  return {
    databaseName,
    hostname: parsedUrl.hostname,
    isLocal:
      parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "localhost",
    value,
  };
}

export function createSqlClient(name, options = {}) {
  const databaseUrl = requireEnvironmentVariable(name);
  parsePostgresUrl(name, databaseUrl);
  return postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 5,
    ...options,
  });
}

export async function assertDatabaseIdentity(sql, name, databaseUrl) {
  const { databaseName } = parsePostgresUrl(name, databaseUrl);
  const [identity] = await sql`select current_database() as database_name`;
  if (identity?.database_name !== databaseName) {
    throw new Error("Connected database does not match the requested target");
  }
}

export async function assertDatabaseEnvironmentIdentity(
  sql,
  name,
  databaseUrl,
) {
  await assertDatabaseIdentity(sql, name, databaseUrl);
  const appEnvironment = requireAppEnvironment();
  const [identity] = await sql`
    select shobj_description(oid, 'pg_database') as environment_identity
    from pg_database
    where datname = current_database()
  `;
  if (
    identity?.environment_identity !== `logos.app_environment=${appEnvironment}`
  ) {
    throw new Error("Connected database environment does not match APP_ENV");
  }
}

export function isInsufficientPrivilege(error) {
  return error && typeof error === "object" && error.code === "42501";
}

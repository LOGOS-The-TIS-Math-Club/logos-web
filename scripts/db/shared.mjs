import postgres from "postgres";

const allowedAppEnvironments = new Set(["development", "preview", "test"]);

export function requireEnvironmentVariable(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export function requireNonProductionEnvironment() {
  const appEnvironment = requireEnvironmentVariable("APP_ENV");
  if (!allowedAppEnvironments.has(appEnvironment)) {
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

  return { databaseName, value };
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

export function isInsufficientPrivilege(error) {
  return error && typeof error === "object" && error.code === "42501";
}

import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import postgres from "postgres";

import {
  assertDatabaseEnvironmentIdentity,
  createSqlClient,
  requireEnvironmentVariable,
  requireNonProductionEnvironment,
} from "./shared.mjs";

const execFileAsync = promisify(execFile);
requireNonProductionEnvironment();

const testDatabaseUrl = requireEnvironmentVariable("TEST_DATABASE_URL");
const backupDatabaseUrl = requireEnvironmentVariable("BACKUP_DATABASE_URL");
const toolsContainer = process.env["POSTGRES_TOOLS_CONTAINER"];
const toolsOwnerDatabaseUrl = toolsContainer
  ? requireEnvironmentVariable("POSTGRES_CONTAINER_DATABASE_URL")
  : testDatabaseUrl;
const toolsBackupDatabaseUrl = toolsContainer
  ? requireEnvironmentVariable("POSTGRES_CONTAINER_BACKUP_DATABASE_URL")
  : backupDatabaseUrl;
const restoreDatabaseName = `logos_restore_${process.pid}`;
const restoreUrl = new URL(testDatabaseUrl);
restoreUrl.pathname = `/${restoreDatabaseName}`;
const toolsRestoreUrl = new URL(toolsOwnerDatabaseUrl);
toolsRestoreUrl.pathname = `/${restoreDatabaseName}`;

let dumpPath;
let sourceSql;
let temporaryDirectory;

function libpqEnvironment(databaseUrl) {
  const parsedUrl = new URL(databaseUrl);
  const environment = Object.fromEntries(
    Object.entries(process.env).filter((entry) => entry[1] !== undefined),
  );
  for (const name of [
    "PGHOST",
    "PGPORT",
    "PGDATABASE",
    "PGUSER",
    "PGPASSWORD",
    "PGSSLMODE",
    "PGCHANNELBINDING",
    "PGOPTIONS",
  ]) {
    delete environment[name];
  }
  environment.PGHOST = parsedUrl.hostname;
  environment.PGPORT = parsedUrl.port || "5432";
  environment.PGDATABASE = decodeURIComponent(parsedUrl.pathname.slice(1));
  environment.PGUSER = decodeURIComponent(parsedUrl.username);
  environment.PGPASSWORD = decodeURIComponent(parsedUrl.password);

  const sslMode = parsedUrl.searchParams.get("sslmode");
  const channelBinding = parsedUrl.searchParams.get("channel_binding");
  const options = parsedUrl.searchParams.get("options");
  if (sslMode) environment.PGSSLMODE = sslMode;
  if (channelBinding) environment.PGCHANNELBINDING = channelBinding;
  if (options) environment.PGOPTIONS = options;
  return environment;
}

async function runPostgresTool(command, arguments_, databaseUrl) {
  const environment = libpqEnvironment(databaseUrl);
  if (toolsContainer) {
    const forwardedVariables = [
      "PGHOST",
      "PGPORT",
      "PGDATABASE",
      "PGUSER",
      "PGPASSWORD",
      "PGSSLMODE",
      "PGCHANNELBINDING",
      "PGOPTIONS",
    ].filter((name) => Object.hasOwn(environment, name));
    return execFileAsync(
      "docker",
      [
        "exec",
        ...forwardedVariables.flatMap((name) => ["--env", name]),
        toolsContainer,
        command,
        ...arguments_,
      ],
      { env: environment },
    );
  }
  return execFileAsync(command, arguments_, { env: environment });
}

try {
  sourceSql = createSqlClient("TEST_DATABASE_URL");
  await assertDatabaseEnvironmentIdentity(
    sourceSql,
    "TEST_DATABASE_URL",
    testDatabaseUrl,
  );

  if (toolsContainer) {
    dumpPath = `/tmp/logos-phase02-${process.pid}.dump`;
  } else {
    temporaryDirectory = await mkdtemp(
      path.join(os.tmpdir(), "logos-restore-"),
    );
    dumpPath = path.join(temporaryDirectory, "synthetic.dump");
  }

  await runPostgresTool(
    "pg_dump",
    ["--format=custom", "--no-owner", `--file=${dumpPath}`],
    toolsBackupDatabaseUrl,
  );
  await runPostgresTool(
    "createdb",
    [restoreDatabaseName],
    toolsOwnerDatabaseUrl,
  );
  await runPostgresTool(
    "pg_restore",
    [
      "--exit-on-error",
      "--no-owner",
      `--dbname=${restoreDatabaseName}`,
      dumpPath,
    ],
    toolsRestoreUrl.toString(),
  );

  const restoredSql = postgres(restoreUrl.toString(), { max: 1 });
  try {
    const [restoredFixture] = await restoredSql`
      select marker from logos.infrastructure_probe where id = 1
    `;
    const [restoredMigration] = await restoredSql`
      select count(*)::integer as count from drizzle.__drizzle_migrations
    `;
    const [restoredPrivileges] = await restoredSql`
      select
        has_schema_privilege('logos_runtime', 'logos', 'USAGE') as runtime_usage,
        has_table_privilege('logos_runtime', 'logos.infrastructure_probe', 'INSERT') as runtime_insert,
        has_table_privilege('logos_runtime', 'logos.business_audit_journal', 'INSERT') as runtime_audit_insert,
        has_table_privilege('logos_runtime', 'logos.business_audit_journal', 'SELECT') as runtime_audit_select,
        has_table_privilege('logos_backup', 'logos.infrastructure_probe', 'SELECT') as backup_select,
        has_table_privilege('logos_backup', 'logos.business_audit_journal', 'SELECT') as backup_audit_select,
        has_table_privilege('logos_backup', 'logos.infrastructure_probe', 'INSERT') as backup_insert
    `;
    if (
      restoredFixture?.marker !== "logos-phase-02-synthetic" ||
      restoredMigration?.count !== 3 ||
      !restoredPrivileges?.runtime_usage ||
      !restoredPrivileges.runtime_insert ||
      !restoredPrivileges.runtime_audit_insert ||
      restoredPrivileges.runtime_audit_select ||
      !restoredPrivileges.backup_select ||
      !restoredPrivileges.backup_audit_select ||
      restoredPrivileges.backup_insert
    ) {
      throw new Error(
        "Restored schema, grants, or synthetic fixture did not match",
      );
    }
  } finally {
    await restoredSql.end();
  }

  console.log("Synthetic export and restore verification passed.");
} finally {
  await sourceSql?.end().catch(() => undefined);
  await runPostgresTool(
    "dropdb",
    ["--if-exists", restoreDatabaseName],
    toolsOwnerDatabaseUrl,
  ).catch(() => undefined);
  if (toolsContainer && dumpPath) {
    await execFileAsync("docker", [
      "exec",
      toolsContainer,
      "rm",
      "-f",
      dumpPath,
    ]).catch(() => undefined);
  }
  if (temporaryDirectory) {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

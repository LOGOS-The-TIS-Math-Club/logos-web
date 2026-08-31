import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import postgres from "postgres";

import {
  assertDatabaseIdentity,
  createSqlClient,
  requireEnvironmentVariable,
  requireNonProductionEnvironment,
} from "./shared.mjs";

const execFileAsync = promisify(execFile);
requireNonProductionEnvironment();

const testDatabaseUrl = requireEnvironmentVariable("TEST_DATABASE_URL");
const toolsContainer = process.env["POSTGRES_TOOLS_CONTAINER"];
const toolsDatabaseUrl = toolsContainer
  ? requireEnvironmentVariable("POSTGRES_CONTAINER_DATABASE_URL")
  : testDatabaseUrl;
const restoreDatabaseName = `logos_restore_${process.pid}`;
const restoreUrl = new URL(testDatabaseUrl);
restoreUrl.pathname = `/${restoreDatabaseName}`;
const toolsRestoreUrl = new URL(toolsDatabaseUrl);
toolsRestoreUrl.pathname = `/${restoreDatabaseName}`;
const temporaryDirectory = await mkdtemp(
  path.join(os.tmpdir(), "logos-restore-"),
);
const dumpPath = toolsContainer
  ? `/tmp/logos-phase02-${process.pid}.dump`
  : path.join(temporaryDirectory, "synthetic.dump");
const sourceSql = createSqlClient("TEST_DATABASE_URL");

async function runPostgresTool(command, arguments_) {
  if (toolsContainer) {
    return execFileAsync("docker", [
      "exec",
      toolsContainer,
      command,
      ...arguments_,
    ]);
  }
  return execFileAsync(command, arguments_);
}

try {
  await assertDatabaseIdentity(sourceSql, "TEST_DATABASE_URL", testDatabaseUrl);
  await runPostgresTool("pg_dump", [
    "--format=custom",
    "--no-owner",
    "--role=logos_backup",
    `--file=${dumpPath}`,
    toolsDatabaseUrl,
  ]);

  await runPostgresTool("createdb", [
    `--maintenance-db=${toolsDatabaseUrl}`,
    restoreDatabaseName,
  ]);

  await runPostgresTool("pg_restore", [
    "--exit-on-error",
    "--no-owner",
    `--dbname=${toolsRestoreUrl.toString()}`,
    dumpPath,
  ]);

  const restoredSql = postgres(restoreUrl.toString(), { max: 1 });
  try {
    const [restoredFixture] = await restoredSql`
      select marker from logos.infrastructure_probe where id = 1
    `;
    const [restoredMigration] = await restoredSql`
      select count(*)::integer as count from drizzle.__drizzle_migrations
    `;
    if (
      restoredFixture?.marker !== "logos-phase-02-synthetic" ||
      restoredMigration?.count !== 1
    ) {
      throw new Error("Restored schema or synthetic fixture did not match");
    }
  } finally {
    await restoredSql.end();
  }

  console.log("Synthetic export and restore verification passed.");
} finally {
  await sourceSql.end();
  await runPostgresTool("dropdb", [
    "--if-exists",
    `--maintenance-db=${toolsDatabaseUrl}`,
    restoreDatabaseName,
  ]).catch(() => undefined);
  if (toolsContainer) {
    await execFileAsync("docker", [
      "exec",
      toolsContainer,
      "rm",
      "-f",
      dumpPath,
    ]).catch(() => undefined);
  }
  await rm(temporaryDirectory, { recursive: true, force: true });
}

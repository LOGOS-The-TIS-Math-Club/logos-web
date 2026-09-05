import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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

/*
 * Derived from the committed journal rather than written as a literal.
 * This assertion previously hard-coded the migration count, so every new
 * migration broke the restore check for reasons unrelated to the restore.
 */
const journal = JSON.parse(
  await readFile(
    new URL("../../drizzle/meta/_journal.json", import.meta.url),
    "utf8",
  ),
);
const expectedMigrationCount = journal.entries.length;

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
        has_table_privilege('logos_runtime', 'logos.application_identities', 'SELECT') as runtime_identity_select,
        has_function_privilege('logos_runtime', 'logos.resolve_identity_access(text)', 'EXECUTE') as runtime_identity_resolve,
        has_function_privilege('logos_runtime', 'logos.bootstrap_access_admin(uuid, uuid)', 'EXECUTE') as runtime_bootstrap,
        has_table_privilege('logos_backup', 'logos.application_identities', 'SELECT') as backup_identity_select,
        has_table_privilege('logos_runtime', 'logos.student_applications', 'INSERT') as runtime_application_insert,
        has_table_privilege('logos_backup', 'logos.student_applications', 'SELECT') as backup_application_select,
        has_table_privilege('logos_runtime', 'logos.club_members', 'INSERT') as runtime_members_insert,
        has_table_privilege('logos_backup', 'logos.club_members', 'SELECT') as backup_members_select,
        has_table_privilege('logos_runtime', 'logos.club_sessions', 'INSERT') as runtime_sessions_insert,
        has_table_privilege('logos_backup', 'logos.club_sessions', 'SELECT') as backup_sessions_select,
        has_table_privilege('logos_runtime', 'logos.session_attendance', 'INSERT') as runtime_attendance_insert,
        has_table_privilege('logos_backup', 'logos.session_attendance', 'SELECT') as backup_attendance_select,
        has_table_privilege('logos_runtime', 'logos.expected_absences', 'INSERT') as runtime_absences_insert,
        has_table_privilege('logos_backup', 'logos.expected_absences', 'SELECT') as backup_absences_select,
        has_table_privilege('logos_runtime', 'logos.member_warnings', 'INSERT') as runtime_warnings_insert,
        has_table_privilege('logos_backup', 'logos.member_warnings', 'SELECT') as backup_warnings_select,
        has_table_privilege('logos_backup', 'logos.student_applications', 'INSERT') as backup_application_insert,
        has_table_privilege('logos_runtime', 'logos.club_resources', 'INSERT') as runtime_resources_insert,
        has_table_privilege('logos_backup', 'logos.club_resources', 'SELECT') as backup_resources_select,
        has_table_privilege('logos_backup', 'logos.club_resources', 'INSERT') as backup_resources_insert,
        has_table_privilege('logos_runtime', 'logos.announcements', 'INSERT') as runtime_announcements_insert,
        has_table_privilege('logos_backup', 'logos.announcements', 'SELECT') as backup_announcements_select,
        has_table_privilege('logos_backup', 'logos.announcements', 'INSERT') as backup_announcements_insert,
        has_table_privilege('logos_backup', 'logos.infrastructure_probe', 'INSERT') as backup_insert
    `;
    /*
     * Named rather than folded into one boolean so a failure says which
     * guarantee broke. The previous single condition reported only that
     * something did not match, which is a poor thing to read in CI.
     */
    const p = restoredPrivileges ?? {};
    const failures = [
      [
        "synthetic fixture marker survived the restore",
        restoredFixture?.marker === "logos-phase-02-synthetic",
      ],
      [
        `migration count is ${expectedMigrationCount} (found ${restoredMigration?.count})`,
        restoredMigration?.count === expectedMigrationCount,
      ],
      ["runtime keeps schema usage", p.runtime_usage],
      ["runtime may write the probe", p.runtime_insert],
      ["runtime may append to the business journal", p.runtime_audit_insert],
      ["runtime may NOT read the business journal", !p.runtime_audit_select],
      ["backup may read the probe", p.backup_select],
      ["backup may read the business journal", p.backup_audit_select],
      ["runtime may NOT read identities directly", !p.runtime_identity_select],
      ["runtime may resolve identity access", p.runtime_identity_resolve],
      ["runtime may NOT bootstrap an access admin", !p.runtime_bootstrap],
      ["backup may read identities", p.backup_identity_select],
      ["runtime may write applications", p.runtime_application_insert],
      ["backup may read applications", p.backup_application_select],
      ["backup may NOT write applications", !p.backup_application_insert],
      ["runtime may write members", p.runtime_members_insert],
      ["backup may read members", p.backup_members_select],
      ["runtime may write sessions", p.runtime_sessions_insert],
      ["backup may read sessions", p.backup_sessions_select],
      ["runtime may write attendance", p.runtime_attendance_insert],
      ["backup may read attendance", p.backup_attendance_select],
      ["runtime may write absences", p.runtime_absences_insert],
      ["backup may read absences", p.backup_absences_select],
      ["runtime may write warnings", p.runtime_warnings_insert],
      ["backup may read warnings", p.backup_warnings_select],
      ["runtime may write resources", p.runtime_resources_insert],
      ["backup may read resources", p.backup_resources_select],
      ["backup may NOT write resources", !p.backup_resources_insert],
      ["runtime may write announcements", p.runtime_announcements_insert],
      ["backup may read announcements", p.backup_announcements_select],
      ["backup may NOT write announcements", !p.backup_announcements_insert],
      ["backup may NOT write the probe", !p.backup_insert],
    ]
      .filter((entry) => !entry[1])
      .map((entry) => entry[0]);

    if (failures.length > 0) {
      throw new Error(
        `Restored schema, grants, or synthetic fixture did not match:\n  - ${failures.join("\n  - ")}`,
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

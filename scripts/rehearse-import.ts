import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  rm,
  readFile,
  writeFile,
  chmod,
  stat,
} from "node:fs/promises";
import { resolve, relative, isAbsolute, dirname } from "node:path";
import { parseArgs } from "node:util";
import postgres from "postgres";
import { migrate } from "./migrations.ts";
import {
  decisionsInput,
  assertImport,
  type Row,
  hash,
} from "./import/model.ts";
import { buildPlan } from "./import/plan.ts";
import { loadSource, importPlan, verifyImport } from "./import/database.ts";
import { verifySourceRestore } from "./import/restore-check.ts";

process.umask(0o077);
const { values } = parseArgs({
  options: {
    backup: { type: "string" },
    output: { type: "string" },
    decisions: { type: "string" },
  },
});
assertImport(
  values.backup && values.output && values.decisions,
  "Required: --backup <private backup directory> --output <private output directory> --decisions <private JSON file>",
);
const backup = resolve(values.backup),
  output = resolve(values.output);
const within = (parent: string, child: string) => {
  const r = relative(parent, child);
  return !r || (!r.startsWith("..") && !isAbsolute(r));
};
assertImport(
  !within(backup, output) && !within(output, backup),
  "Output and backup must be separate directories",
);
for (let path = output; ; path = dirname(path)) {
  assertImport(
    !(await stat(resolve(path, ".git")).catch(() => null)),
    "Private outputs must be outside all Git repositories",
  );
  if (dirname(path) === path) break;
}
await mkdir(output, { recursive: true, mode: 0o700 });
await chmod(output, 0o700);
const save = async (name: string, value: unknown) =>
  writeFile(resolve(output, name), JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  });
const decisions = decisionsInput.parse(
  JSON.parse(await readFile(resolve(values.decisions), "utf8")),
);
const root = await mkdtemp("/tmp/logos-import-");
const data = resolve(root, "data"),
  socket = resolve(root, "socket");
const clients: postgres.Sql[] = [];
let running = false;
// Never use a connection URL, .env file, selected cloud project, or inherited PG settings.
const env = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !key.startsWith("PG")),
) as NodeJS.ProcessEnv;
Object.assign(env, {
  PGHOST: socket,
  PGPORT: "5432",
  PGUSER: "postgres",
  PGDATABASE: "postgres",
  PGSSLMODE: "disable",
  PGOPTIONS: "-c timezone=UTC",
});
const command = (name: string, args: string[]) =>
  execFileSync(name, args, { env, stdio: "pipe", maxBuffer: 16 * 1024 * 1024 });
const connect = (database: string) => {
  const sql = postgres({
    host: socket,
    port: 5432,
    username: "postgres",
    database,
    max: 1,
    connection: { TimeZone: "UTC" },
    onnotice: () => {},
  });
  clients.push(sql);
  return sql;
};
try {
  const checksumText = await readFile(resolve(backup, "SHA256SUMS"), "utf8");
  let verifiedFiles = 0;
  for (const line of checksumText.trim().split("\n")) {
    const match = /^([0-9a-f]{64})  (.+)$/.exec(line);
    assertImport(match, "Malformed backup checksum manifest");
    const path = resolve(backup, match[2]);
    assertImport(within(backup, path), "Backup checksum path escapes backup");
    const bytes = await readFile(path);
    assertImport(
      createHash("sha256").update(bytes).digest("hex") === match[1],
      `Backup checksum failed: ${match[2]}`,
    );
    verifiedFiles++;
  }
  await mkdir(socket, { mode: 0o700 });
  command("initdb", [
    "-D",
    data,
    "-A",
    "trust",
    "-U",
    "postgres",
    "--no-locale",
    "-E",
    "UTF8",
  ]);
  command("pg_ctl", [
    "-D",
    data,
    "-l",
    resolve(root, "postgres.log"),
    "-o",
    `-F -k ${socket} -c listen_addresses=''`,
    "-w",
    "start",
  ]);
  running = true;
  command("psql", [
    "-X",
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    resolve(backup, "restore-roles.sql"),
  ]);
  command("createdb", ["legacy"]);
  command("createdb", ["rehearsal"]);
  command("createdb", ["roundtrip"]);
  command("pg_restore", [
    "--exit-on-error",
    "--no-owner",
    "--no-acl",
    "--dbname=legacy",
    resolve(backup, "database.dump"),
  ]);
  const legacy = connect("legacy"),
    target = connect("rehearsal");
  const sourceRestore = await verifySourceRestore(legacy, backup);
  const source = await loadSource(legacy);
  const metadata: Row = JSON.parse(
    await readFile(resolve(backup, "source.json"), "utf8"),
  );
  const snapshot = metadata.snapshot_time_utc;
  source.snapshotAt = [{ value: snapshot }];
  const plan = await buildPlan(source, backup, decisions);
  await migrate(target);
  await importPlan(target, plan.target);
  const verified = await verifyImport(target, source, plan.target, snapshot);
  let duplicateImportRejected = false;
  try {
    await importPlan(target, plan.target);
  } catch {
    duplicateImportRejected = true;
  }
  assertImport(
    duplicateImportRejected,
    "Second import should reject a nonempty target",
  );
  command("pg_dump", [
    "--format=custom",
    "--no-owner",
    "--file",
    resolve(output, "rehearsal.dump"),
    "--dbname=rehearsal",
  ]);
  command("pg_restore", [
    "--exit-on-error",
    "--no-owner",
    "--dbname=roundtrip",
    resolve(output, "rehearsal.dump"),
  ]);
  const restored = await verifyImport(
    connect("roundtrip"),
    source,
    plan.target,
    snapshot,
  );
  assertImport(
    hash(verified) === hash(restored),
    "Target dump/restore verification differs",
  );
  const report = {
    snapshot,
    verifiedBackupFiles: verifiedFiles,
    sourceRestore,
    decisionHash: plan.decisionHash,
    importVerified: true,
    roundtripVerified: true,
    duplicateImportRejected,
    productionReady: false,
    findings: plan.findings,
    ...verified,
    legacyRoleCandidates: source["people.technical_access_assignments"]
      .filter((a) => !a.revoked_at)
      .map((a) => ({
        identityId: a.identity_id,
        legacyLevel: a.access_level,
        email: source["people.application_identities"].find(
          (i) => i.id === a.identity_id,
        )?.email,
      })),
    archiveOnly: {
      businessEventsWithoutCurrentActor: source[
        "operations.business_audit_journal"
      ]
        .filter(
          (e) =>
            !source["people.application_identities"].some(
              (i) => i.id === e.actor_id,
            ),
        )
        .map((e) => e.id),
      providerTables:
        "Preserved in private source only; never copied to target",
      operationalTables:
        "Private source only; no legacy queue, probes, rate-limit or security machinery reintroduced",
    },
  };
  await save("report.json", report);
  await save("id-mapping.json", plan.mapping);
  const reviewLines = [
    "# Membership date review",
    "",
    "Recorded Tokyo joining dates were preserved. Earlier ledger records are excluded from percentages; affected percentages remain withheld pending review.",
    "",
  ];
  for (const member of verified.attendance.filter(
    (m) => m.requiresDateReview,
  )) {
    reviewLines.push(
      `## ${member.displayName}`,
      `- Member ID: ${member.memberId}`,
      `- School account: ${member.email}`,
      `- Recorded joining date (Tokyo): ${member.joinedOn}`,
    );
    for (const row of member.excludedRecords)
      reviewLines.push(
        `- ${row.sessionDate}: ${row.status} — attendance ${row.attendanceId}`,
      );
    reviewLines.push("");
  }
  await writeFile(
    resolve(output, "membership-review.md"),
    reviewLines.join("\n") + "\n",
    { mode: 0o600 },
  );

  const findingsByKind: Row = {};
  for (const f of plan.findings)
    findingsByKind[f.kind] = (findingsByKind[f.kind] ?? 0) + 1;
  const lines = [
    "# LOGOS private import rehearsal",
    "",
    `Backup snapshot: ${snapshot}`,
    `Source restored and compared: ${sourceRestore.tables} tables, ${sourceRestore.rows} rows.`,
    `Verified backup files: ${verifiedFiles}. Import and target dump/restore checks passed.`,
    "",
    "## Requires review before cutover",
    ...Object.entries(findingsByKind).map(([kind, n]) => `- ${kind}: ${n}`),
    "",
    "See membership-review.md for the named date-review cases, and report.json for exact record IDs, membership dates, eligible session IDs, content hashes, and withheld attendance previews.",
    "See id-mapping.json for stable source→target identifiers and profile-image/provider associations.",
    "rehearsal.dump contains private student data. It is a local rehearsal artifact, not an approved production import.",
    "",
    "No production database, deployment, domain, Drive permissions, or hosted Auth configuration was changed.",
  ];
  await writeFile(resolve(output, "README.md"), lines.join("\n") + "\n", {
    mode: 0o600,
  });
  await rm(resolve(output, "failure.json"), { force: true });
  console.log(
    JSON.stringify(
      {
        sourceRestore,
        importVerified: true,
        roundtripVerified: true,
        transformedTables: Object.keys(verified.content).length,
        findings: findingsByKind,
        output,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await save("failure.json", {
    message: error instanceof Error ? error.message : String(error),
    code: (error as { code?: string }).code,
  });
  console.error(
    `Rehearsal failed; details are private in ${resolve(output, "failure.json")}`,
  );
  process.exitCode = 1;
} finally {
  for (const sql of clients) await sql.end();
  if (running) command("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]);
  await rm(root, { recursive: true, force: true });
}

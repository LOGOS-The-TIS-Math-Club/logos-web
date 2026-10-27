import { readFile } from "node:fs/promises";
import { verifyRuntime } from "../tests/runtime-database.ts";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import postgres from "postgres";
import { migrate } from "./migrations.ts";
import { verifyImportRollback } from "../tests/import-database.ts";
import { verifyApi } from "../tests/api-database.ts";
import { verifyAuth } from "../tests/auth-database.ts";
import { verifyMeetings } from "../tests/meetings-database.ts";
import { verifyContentReplay } from "../tests/content-replay-database.ts";
import { verifyContent } from "../tests/content-database.ts";
import { verifyMembership } from "../tests/membership-database.ts";
import { verifyDatabase } from "../tests/database.ts";

// Always a disposable local cluster. No environment database URL is read.
const root = await mkdtemp("/tmp/logos-pg-");
const data = `${root}/data`;
const socket = `${root}/socket`;
let running = false;
let sql: postgres.Sql | undefined;
try {
  await mkdir(socket);
  execFileSync(
    "initdb",
    ["-D", data, "-A", "trust", "-U", "postgres", "--no-locale", "-E", "UTF8"],
    { stdio: "pipe" },
  );
  execFileSync(
    "pg_ctl",
    [
      "-D",
      data,
      "-l",
      `${root}/postgres.log`,
      "-o",
      `-F -k ${socket} -c listen_addresses=''`,
      "-w",
      "start",
    ],
    { stdio: "pipe" },
  );
  running = true;
  sql = postgres({
    host: socket,
    username: "postgres",
    database: "postgres",
    max: 8,
    connection: {
      TimeZone:
        process.env.TEST_DATABASE_TIMEZONE === "Asia/Tokyo"
          ? "Asia/Tokyo"
          : "UTC",
    },
    onnotice: () => {},
  });
  await migrate(sql);
  await migrate(sql);
  await verifyImportRollback(sql);
  await verifyDatabase(sql);
  const db = sql;
  const reset = async () => {
    const tables =
      await db`select schemaname,tablename from pg_tables where schemaname in ('people','applications','members','meetings','content','operations')`;
    await db.unsafe(
      "truncate " +
        tables.map((t) => `"${t.schemaname}"."${t.tablename}"`).join(",") +
        " restart identity cascade",
    );
  };
  await reset();
  await verifyMeetings(sql);
  await reset();
  await verifyContent(sql);
  await reset();
  await verifyContentReplay(sql);
  await reset();
  await verifyMembership(sql);
  await reset();
  await verifyAuth(sql);
  await reset();
  await verifyApi(sql);
  await sql.unsafe(
    await readFile(new URL("../db/runtime-role.sql", import.meta.url), "utf8"),
  );
  await reset();
  const runtime = postgres({
    host: socket,
    username: "postgres",
    database: "postgres",
    max: 4,
    connection: { options: "-c role=logos_runtime" },
    onnotice: () => {},
  });
  try {
    await verifyRuntime(runtime);
    await verifyApi(runtime);
    await reset();
    await verifyContentReplay(runtime, false);
  } finally {
    await runtime.end();
  }
  console.log(
    "Database checks passed; migrations applied twice without changes.",
  );
} finally {
  if (sql) await sql.end();
  if (running)
    execFileSync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"], {
      stdio: "pipe",
    });
  await rm(root, { recursive: true, force: true });
}

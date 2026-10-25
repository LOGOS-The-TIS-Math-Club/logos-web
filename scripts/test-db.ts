import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import postgres from "postgres";
import { migrate } from "./migrations.ts";
import { verifyImportRollback } from "../tests/import-database.ts";
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
    onnotice: () => {},
  });
  await migrate(sql);
  await migrate(sql);
  await verifyImportRollback(sql);
  await verifyDatabase(sql);
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

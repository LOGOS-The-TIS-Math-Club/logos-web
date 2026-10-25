import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type postgres from "postgres";
import { assertImport } from "./model.ts";

export async function verifySourceRestore(sql: postgres.Sql, backup: string) {
  const counts: Record<string, number> = JSON.parse(
    await readFile(resolve(backup, "table-counts.json"), "utf8"),
  );
  let total = 0;
  await sql.begin(async (tx) => {
    for (const [table, count] of Object.entries(counts)) {
      assertImport(
        /^[a-z_]+\.[a-z_]+$/.test(table),
        "Invalid backup table name",
      );
      const name = table
        .split(".")
        .map((v) => `"${v}"`)
        .join(".");
      const file = resolve(backup, "csv", `${table}.csv`);
      const header = (await readFile(file, "utf8")).split("\n")[0];
      const fields = header.split(",").map((v) => v.replace(/^"|"$/g, ""));
      assertImport(
        fields.every((v) => /^[a-zA-Z_]+$/.test(v)),
        "Unexpected CSV field name",
      );
      const columns = fields.map((v) => `"${v}"`).join(",");
      // PostgreSQL COPY omits generated columns. Compare the exported columns,
      // preserving native JSON, microsecond timestamps, and bytea values.
      await tx.unsafe(
        `CREATE TEMP TABLE csv_restore_check AS SELECT ${columns} FROM ${name} WITH NO DATA`,
      );
      await tx.unsafe(
        `COPY csv_restore_check FROM '${file.replaceAll("'", "''")}' WITH (FORMAT CSV, HEADER TRUE)`,
      );
      const [diff] =
        await tx.unsafe(`SELECT (SELECT count(*)::int FROM ${name}) as n,
        EXISTS((SELECT to_jsonb(t) FROM (SELECT ${columns} FROM ${name}) t EXCEPT ALL SELECT to_jsonb(c) FROM csv_restore_check c)
        UNION ALL (SELECT to_jsonb(c) FROM csv_restore_check c EXCEPT ALL SELECT to_jsonb(t) FROM (SELECT ${columns} FROM ${name}) t)) as different`);
      assertImport(
        diff.n === count && !diff.different,
        `Native restore differs from verified CSV: ${table}`,
      );
      await tx`drop table csv_restore_check`;
      total += count;
    }
    for (const table of ["business_audit_journal", "security_audit_journal"]) {
      const [bad] = await tx.unsafe(
        `SELECT count(*)::int AS n FROM operations.${table} WHERE tokyo_archive_date IS DISTINCT FROM (recorded_at AT TIME ZONE 'Asia/Tokyo')::date`,
      );
      assertImport(
        bad.n === 0,
        "Generated archive dates disagree with source timestamps",
      );
    }
  });
  return {
    tables: Object.keys(counts).length,
    rows: total,
    allTypedRowsMatchCsv: true,
    generatedDatesVerified: true,
  };
}

import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import type postgres from "postgres";

export async function migrate(sql: postgres.Sql) {
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(617832194)`;
    await tx`create schema if not exists migrations`;
    await tx`create table if not exists migrations.applied (name text primary key, sha256 text not null, applied_at timestamptz not null default now())`;
    const files = (await readdir(new URL("../db/migrations/", import.meta.url)))
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const name of files) {
      const source = await readFile(
        new URL(`../db/migrations/${name}`, import.meta.url),
        "utf8",
      );
      const hash = createHash("sha256").update(source).digest("hex");
      const [applied] =
        await tx`select sha256 from migrations.applied where name = ${name}`;
      if (applied) {
        if (applied.sha256 !== hash)
          throw new Error(`Applied migration changed: ${name}`);
        continue;
      }
      await tx.unsafe(source);
      await tx`insert into migrations.applied(name, sha256) values (${name}, ${hash})`;
    }
  });
}

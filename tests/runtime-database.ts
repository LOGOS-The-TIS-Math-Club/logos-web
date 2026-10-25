import assert from "node:assert/strict";
import type postgres from "postgres";
export async function verifyRuntime(sql: postgres.Sql) {
  const [role] = await sql`select current_user as name`;
  assert.equal(role.name, "logos_runtime");
  await sql`select "accountId","idToken" from neon_auth.account limit 1`;
  await assert.rejects(
    sql`delete from neon_auth.account`,
    (e: unknown) => (e as { code: string }).code === "42501",
  );
  await assert.rejects(
    sql`create table people.forbidden_test(id integer)`,
    (e: unknown) => (e as { code: string }).code === "42501",
  );
  await assert.rejects(
    sql`select * from migrations.applied`,
    (e: unknown) => (e as { code: string }).code === "42501",
  );
}

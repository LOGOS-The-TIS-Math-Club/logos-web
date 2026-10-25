import assert from "node:assert/strict";
import type postgres from "postgres";
import { randomUUID } from "node:crypto";
import { importPlan } from "../scripts/import/database.ts";

export async function verifyImportRollback(sql: postgres.Sql) {
  const identity = randomUUID(),
    year = randomUUID();
  await assert.rejects(
    importPlan(sql, {
      "people.identities": [
        {
          id: identity,
          email: "import-test@tokyois.com",
          school_verified: true,
          enabled: true,
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
          auth_user_id: null,
          google_subject: null,
          profile_image_id: null,
        },
      ],
      "meetings.academic_years": [
        {
          id: year,
          name: "2026–27",
          start_year: 2026,
          starts_on: "2026-08-01",
          ends_on: "2027-08-01",
        },
      ],
      "members.memberships": [
        {
          id: randomUUID(),
          identity_id: identity,
          display_name: "Invalid grade",
          grade: 8,
          grade_academic_year: 2026,
        },
      ],
    }),
    (error: unknown) => (error as { code: string }).code === "23514",
  );
  assert.equal(
    (await sql`select count(*)::int as n from people.identities`)[0].n,
    0,
  );
  assert.equal(
    (await sql`select count(*)::int as n from meetings.academic_years`)[0].n,
    0,
  );
  assert.equal(
    (
      await sql`select tgenabled from pg_trigger where tgname='submission_guard'`
    )[0].tgenabled,
    "O",
  );
  console.log(
    "Passed: failed imports roll back every row and restore submission protection.",
  );
}

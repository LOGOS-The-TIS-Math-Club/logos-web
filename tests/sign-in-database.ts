import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { createCurrentUser } from "../src/auth/current-user.ts";
import { resolveAccount } from "../src/auth/account-state.ts";
import { accountDestinations } from "../src/auth/navigation.ts";
import { getOwnApplications } from "../src/access/operations.ts";

// Synthetic provider rows belong only to the disposable test cluster.
export async function verifySignIn(sql: postgres.Sql) {
  const authId = `synthetic-sign-in-${randomUUID()}`;
  const email = `${authId}@tokyois.com`;
  const [identity] = await sql`insert into people.identities(auth_user_id,google_subject,email,school_verified)
    values (${authId},${authId},${email},true) returning id`;
  await sql`insert into neon_auth.account(id,"userId","providerId","accountId") values (${authId},${authId},'google',${authId})`;
  const currentUser = createCurrentUser(sql, async () => ({ user: { id: authId, email, emailVerified: true } }));
  const read = () => resolveAccount({ configured: true, currentUser, applications: id => getOwnApplications(sql, id) });
  const before = await read();
  assert.equal(before.status, "signed-in");
  if (before.status !== "signed-in") throw Error("Expected synthetic account");
  assert.deepEqual(accountDestinations(before.user, before.hasApplication), ["Apply"]);
  const [{ year }] = await sql`select extract(year from ((now() at time zone 'Asia/Tokyo') - interval '7 months'))::int as year`;
  const [academicYear] = await sql`insert into meetings.academic_years(name,start_year,starts_on,ends_on)
    values (${`Synthetic sign-in ${year}`},${year},make_date(${year},8,1),make_date(${year + 1},8,1))
    on conflict (start_year) do update set start_year=excluded.start_year returning start_year`;
  const [membership] = await sql`insert into members.memberships(identity_id,display_name,grade,grade_academic_year)
    values (${identity.id},'Synthetic sign-in member',10,${academicYear.start_year}) returning id`;
  await sql`insert into people.role_grants(identity_id,role) values (${identity.id},'member')`;
  for (const status of ["active", "paused", "former"] as const) {
    await sql`insert into members.state_changes(member_id,effective_on,status,departure_reason,recorded_by)
      values (${membership.id},(now() at time zone 'Asia/Tokyo')::date,${status},${status === "former" ? "quit" : null},${identity.id})
      on conflict (member_id,effective_on) do update set status=excluded.status,departure_reason=excluded.departure_reason`;
    const state = await read();
    assert.equal(state.status, "signed-in");
    if (state.status !== "signed-in") throw Error("Expected synthetic account");
    assert.equal(state.user.member, status !== "former");
    assert.deepEqual(accountDestinations(state.user, state.hasApplication), status === "former" ? ["Apply"] : ["Open dashboard"]);
  }
  await sql`insert into people.role_grants(identity_id,role) values (${identity.id},'admin')`;
  const admin = await read();
  if (admin.status !== "signed-in") throw Error("Expected synthetic admin");
  assert.deepEqual(accountDestinations(admin.user, admin.hasApplication), ["Open dashboard", "Leadership controls"]);
  await sql`update people.identities set enabled=false where id=${identity.id}`;
  assert.deepEqual(await read(), { status: "denied", code: "FORBIDDEN" });
}

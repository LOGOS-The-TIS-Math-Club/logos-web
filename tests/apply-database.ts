import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { createApi } from "../src/server/api.ts";
import { BackendError } from "../src/server/errors.ts";
import { academicYearAt } from "../src/membership/grade.ts";
import {
  transitionApplication,
  acceptApplicationReview,
} from "../src/applications/review.ts";
import type { ApplicationEntry } from "../src/applications/presentation.ts";
import { getOwnApplicationEntry } from "../src/applications/entry.ts";

export async function verifyUnconfiguredApply(sql: postgres.Sql) {
  const [identity] =
    await sql`insert into people.identities(email,school_verified)
    values (${`synthetic-unconfigured-${randomUUID()}@tokyois.com`},true) returning id`;
  const entry = await getOwnApplicationEntry(sql, identity.id);
  assert.equal(entry.academicYear, null);
  assert.equal(entry.blockedBy, null);
  assert.deepEqual(entry.applications, []);
}

export async function verifyApply(sql: postgres.Sql) {
  const suffix = randomUUID();
  const [person, other, admin] = await sql<
    { id: string; email: string }[]
  >`insert into people.identities(email,school_verified)
    values (${`synthetic-apply-${suffix}@tokyois.com`},true),(${`synthetic-other-${suffix}@tokyois.com`},true),(${`synthetic-admin-${suffix}@tokyois.com`},true) returning id,email`;
  await sql`insert into people.role_grants(identity_id,role) values (${admin.id},'admin')`;
  const origin = "http://localhost:3999";
  const apiFor = (identity: { id: string; email: string }) =>
    createApi({
      sql,
      appUrl: origin,
      currentUser: async () => ({ ...identity, member: false, admin: false }),
    });
  const api = apiFor(person),
    otherApi = apiFor(other);
  const get = (path: string) => new Request(origin + path);
  const post = (path: string, body: unknown) =>
    new Request(origin + path, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  async function entry() {
    const response = await api(get("/api/me/applications/entry"));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("cache-control")!, /no-store, private/);
    return (await response.json()).data as ApplicationEntry;
  }
  const year = academicYearAt(new Date());
  await sql`insert into meetings.academic_years(name,start_year,starts_on,ends_on)
    values (${`Synthetic Apply ${year}`},${year},${`${year}-08-01`}::date,${`${year + 1}-08-01`}::date) on conflict(start_year) do nothing`;
  const fresh = await entry();
  assert.equal(fresh.blockedBy, null);
  assert.equal(fresh.academicYear?.startYear, year);
  assert.equal(fresh.applications.length, 0);
  const input = {
    preferredName: "Synthetic Applicant",
    grade: 10,
    gradeAcademicYear: year,
    academicInterests: ["algebra"],
    joinReason: "I want to explore mathematics with other interested students.",
    goals: "I want to explain interesting problems and learn new methods.",
    mathCourse: "prefer_not_to_say",
    contestInterest: "maybe",
    presentInterest: "yes",
    attendanceConfirmation: "occasional_conflicts",
    accuracyAcknowledged: true,
  };
  const bad = await api(
    post("/api/me/applications", { ...input, joinReason: "short" }),
  );
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.fields[0].field, "joinReason");
  const requestId = randomUUID();
  const results = await Promise.all([
    api(post("/api/me/applications", { ...input, requestId })),
    api(post("/api/me/applications", { ...input, requestId })),
  ]);
  for (const result of results) {
    assert.equal(result.status, 201);
    assert.equal((await result.json()).data.id, requestId);
  }
  let state = await entry();
  assert.equal(state.applications.length, 1);
  assert.equal(state.blockedBy, "open_application");
  assert.equal(state.applications[0].canWithdraw, true);
  assert.equal(state.applications[0].math_course, null);
  const serialized = JSON.stringify(state);
  for (const field of [
    "status_reason",
    "reviewed_by",
    "private_notes",
    "member_id",
  ])
    assert.ok(!serialized.includes(field));
  assert.equal(
    (
      await api(
        post("/api/me/applications", {
          ...input,
          requestId,
          goals:
            "These are changed answers under an already committed request ID.",
        }),
      )
    ).status,
    409,
  );
  assert.equal(
    (await otherApi(post("/api/me/applications", { ...input, requestId })))
      .status,
    409,
  );
  assert.equal(
    (await otherApi(get(`/api/me/applications/${requestId}`))).status,
    404,
  );
  assert.equal(
    (await (await otherApi(get("/api/me/applications/entry"))).json()).data
      .applications.length,
    0,
  );
  await transitionApplication(
    sql,
    admin.id,
    requestId,
    1,
    "under_review",
    "Synthetic private review note",
  );
  state = await entry();
  assert.equal(state.applications[0].status, "under_review");
  assert.ok(!JSON.stringify(state).includes("Synthetic private review note"));
  assert.equal(
    (
      await api(
        post(`/api/me/applications/${requestId}/withdraw`, { revision: 1 }),
      )
    ).status,
    409,
  );
  assert.equal(
    (
      await api(
        post(`/api/me/applications/${requestId}/withdraw`, {
          revision: state.applications[0].revision,
        }),
      )
    ).status,
    200,
  );
  state = await entry();
  assert.equal(state.applications[0].status, "withdrawn");
  assert.equal(state.applications[0].canWithdraw, false);
  assert.equal(state.blockedBy, null);
  const replay = await api(
    post("/api/me/applications", { ...input, requestId }),
  );
  assert.equal(replay.status, 201);
  assert.equal((await replay.json()).data.status, "withdrawn");
  assert.equal((await entry()).applications.length, 1);
  const nextId = randomUUID();
  assert.equal(
    (await api(post("/api/me/applications", { ...input, requestId: nextId })))
      .status,
    201,
  );
  await transitionApplication(
    sql,
    admin.id,
    nextId,
    1,
    "rejected",
    "Synthetic private reason",
  );
  assert.equal((await entry()).blockedBy, null);
  assert.equal((await entry()).applications.length, 2);
  assert.equal(
    (
      await (
        await api(post("/api/me/applications", { ...input, requestId: nextId }))
      ).json()
    ).data.status,
    "rejected",
  );
  const [restriction] =
    await sql`insert into applications.reapplication_restrictions(identity_id,reason,recorded_by)
    values (${person.id},'Synthetic private restriction',${admin.id}) returning id`;
  state = await entry();
  assert.equal(state.blockedBy, "restricted");
  assert.ok(!JSON.stringify(state).includes("Synthetic private restriction"));
  assert.equal(
    (
      await api(
        post("/api/me/applications", { ...input, requestId: randomUUID() }),
      )
    ).status,
    422,
  );
  await sql`update applications.reapplication_restrictions set ends_at=now() where id=${restriction.id}`;
  const acceptedId = randomUUID();
  assert.equal(
    (
      await api(
        post("/api/me/applications", { ...input, requestId: acceptedId }),
      )
    ).status,
    201,
  );
  const [{ today }] =
    await sql`select ((now() at time zone 'Asia/Tokyo')::date)::text as today`;
  const membership = await acceptApplicationReview(
    sql,
    admin.id,
    acceptedId,
    1,
    {
      displayName: "Synthetic Member",
      grade: 10,
      gradeAcademicYear: year,
      startsOn: today,
      privateNotes: "Synthetic private membership note",
    },
  );
  assert.equal((await entry()).blockedBy, "current_member");
  await sql`update members.state_changes set status='paused' where member_id=${membership}`;
  assert.equal((await entry()).blockedBy, "current_member");
  await sql`update members.state_changes set status='former',departure_reason='quit' where member_id=${membership}`;
  assert.equal((await entry()).blockedBy, null);
  const denied = createApi({
    sql,
    appUrl: origin,
    currentUser: async () => {
      throw new BackendError("UNAUTHENTICATED", "Sign in", 401);
    },
  });
  assert.equal((await denied(get("/api/me/applications/entry"))).status, 401);
  await sql`update people.identities set enabled=false where id=${person.id}`;
  assert.equal((await api(get("/api/me/applications/entry"))).status, 403);
  assert.equal(
    (await api(post("/api/me/applications", { ...input, requestId }))).status,
    403,
  );
}

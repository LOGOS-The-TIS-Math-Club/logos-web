import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { createApi } from "../src/server/api.ts";
import type { CurrentUser } from "../src/auth/current-user.ts";
import { BackendError } from "../src/server/errors.ts";

const appOrigin = "https://club.example.test";

export async function verifyApi(sql: postgres.Sql) {
  const suffix = randomUUID().slice(0, 8);
  const [admin] = await sql`insert into people.identities(email,school_verified)
    values (${`api-admin-${suffix}@tokyois.com`},true) returning id`;
  const [memberIdentity] =
    await sql`insert into people.identities(email,school_verified)
    values (${`api-member-${suffix}@tokyois.com`},true) returning id`;
  const [applicant] =
    await sql`insert into people.identities(email,school_verified)
    values (${`api-applicant-${suffix}@tokyois.com`},true) returning id`;
  const [other] = await sql`insert into people.identities(email,school_verified)
    values (${`api-other-${suffix}@tokyois.com`},true) returning id`;
  const [denied] = await sql`insert into people.identities(email)
    values (${`api-denied-${suffix}@example.invalid`}) returning id`;
  await sql`insert into people.role_grants(identity_id,role)
    values (${admin.id},'admin'),(${memberIdentity.id},'member')`;
  const [year] =
    await sql`insert into meetings.academic_years(name,start_year,starts_on,ends_on)
    values (${`API ${suffix}`},2038,'2038-08-01','2039-08-01') returning id`;
  const [term] =
    await sql`insert into meetings.terms(academic_year_id,name,starts_on,ends_on)
    values (${year.id},'API term','2038-08-01','2039-08-01') returning id`;
  const [member] =
    await sql`insert into members.memberships(identity_id,display_name,grade,grade_academic_year)
    values (${memberIdentity.id},'API Member',10,2038) returning id`;
  await sql`insert into members.state_changes(member_id,effective_on,status,recorded_by)
    values (${member.id},'2026-08-01','active',${admin.id})`;

  const asUser = (user: CurrentUser) =>
    createApi({
      sql,
      currentUser: async () => user,
      appUrl: appOrigin,
    });
  const adminApi = asUser({
    id: admin.id,
    email: `api-admin-${suffix}@tokyois.com`,
    admin: true,
    member: false,
  });
  const memberApi = asUser({
    id: memberIdentity.id,
    email: `api-member-${suffix}@tokyois.com`,
    admin: false,
    member: true,
  });
  const applicantApi = asUser({
    id: applicant.id,
    email: `api-applicant-${suffix}@tokyois.com`,
    admin: false,
    member: false,
  });
  const otherApi = asUser({
    id: other.id,
    email: `api-other-${suffix}@tokyois.com`,
    admin: false,
    member: false,
  });
  const deniedApi = asUser({
    id: denied.id,
    email: `api-denied-${suffix}@example.invalid`,
    admin: false,
    member: false,
  });

  const aId = randomUUID();
  const bId = randomUUID();
  const aCreate = await adminApi(
    post("/api/admin/sessions", {
      id: aId,
      termId: term.id,
      date: "2038-08-20",
      startTime: "15:00",
      durationMinutes: 60,
      title: "API session A",
    }),
  );
  assert.equal(aCreate.status, 201);
  const aCreated = await responseData<{ id: string; revision: number }>(
    aCreate,
  );
  const bCreate = await adminApi(
    post("/api/admin/sessions", {
      id: bId,
      termId: term.id,
      date: "2038-08-21",
      startTime: "15:00",
      durationMinutes: 60,
      title: "API session B",
    }),
  );
  assert.equal(bCreate.status, 201);

  const unauthApi = createApi({
    sql,
    currentUser: async () => {
      throw new BackendError("UNAUTHENTICATED", "Sign in required", 401);
    },
    appUrl: appOrigin,
  });
  assert.equal((await unauthApi(get("/api/me/applications"))).status, 401);
  assert.equal((await deniedApi(get("/api/calendar"))).status, 403);
  assert.equal(
    (
      await deniedApi(
        post("/api/admin/sessions", {
          id: randomUUID(),
          termId: term.id,
          date: "2038-08-22",
          startTime: "15:00",
          durationMinutes: 60,
          title: "Denied session",
        }),
      )
    ).status,
    403,
  );

  const firstA = await adminApi(get(`/api/admin/sessions/${aId}/attendance`));
  assert.equal(firstA.status, 200);
  assert.equal(firstA.headers.get("cache-control"), "no-store, private");
  const aAttendance = await responseData<{
    sessionRevision: number;
    roster: unknown[];
  }>(firstA);
  assert.equal(aAttendance.sessionRevision, aCreated.revision);
  assert.equal(aAttendance.roster.length, 1);
  const firstB = await adminApi(get(`/api/admin/sessions/${bId}/attendance`));
  assert.equal(firstB.status, 200);
  const bAttendance = await responseData<{
    sessionId: string;
    roster: unknown[];
  }>(firstB);
  assert.equal(bAttendance.sessionId, bId);
  assert.equal(bAttendance.roster.length, 1);

  const attendanceSave = await adminApi(
    put(`/api/admin/sessions/${aId}/attendance`, {
      revision: aAttendance.sessionRevision,
      records: [{ memberId: member.id, status: "present", notes: "On time" }],
    }),
  );
  assert.equal(attendanceSave.status, 200);
  const saved = await responseData<{ revision: number }>(attendanceSave);
  const reread = await adminApi(get(`/api/admin/sessions/${aId}/attendance`));
  const rereadData = await responseData<{
    sessionRevision: number;
    roster: Array<{ status: string }>;
  }>(reread);
  assert.equal(rereadData.sessionRevision, saved.revision);
  assert.equal(rereadData.roster[0].status, "present");
  const stale = await adminApi(
    put(`/api/admin/sessions/${aId}/attendance`, {
      revision: aAttendance.sessionRevision,
      records: [{ memberId: member.id, status: "late" }],
    }),
  );
  assert.equal(stale.status, 409);
  assert.equal(
    (await adminApi(get(`/api/admin/sessions/${bId}/attendance`))).status,
    200,
  );

  const bAfterSave = await responseData<{
    sessionId: string;
    roster: Array<{ status: string }>;
  }>(await adminApi(get(`/api/admin/sessions/${bId}/attendance`)));
  assert.equal(bAfterSave.sessionId, bId);
  assert.equal(bAfterSave.roster[0].status, "unmarked");
  for (const path of [
    "/api/calendar/extra",
    `/api/sessions/${aId}/extra`,
    "/api/admin/content/stories/extra/extra",
  ])
    assert.equal((await adminApi(get(path))).status, 404);
  assert.equal(
    (
      await adminApi(
        get(`/api/sessions?termId=${term.id}&academicYearId=${year.id}`),
      )
    ).status,
    400,
  );
  const noticeResponse = await memberApi(
    post("/api/me/absences", {
      sessionDate: "2038-08-22",
      reason: "A separate notice",
    }),
  );
  assert.equal(noticeResponse.status, 201);
  const noticeList = await responseData<Array<{ reason: string }>>(
    await adminApi(get("/api/admin/absences")),
  );
  assert.equal(noticeList.length, 1);
  assert.equal(noticeList[0].reason, "A separate notice");
  assert.equal((await memberApi(get("/api/admin/absences"))).status, 403);

  const application = await applicantApi(
    post("/api/me/applications", {
      preferredName: "Applicant",
      grade: 9,
      gradeAcademicYear: 2038,
      academicInterests: ["algebra"],
      joinReason: "I want to explore mathematics with other students.",
      goals: "I want to learn new methods and solve interesting problems.",
      contestInterest: "maybe",
      presentInterest: "yes",
      attendanceConfirmation: "regular",
      accuracyAcknowledged: true,
    }),
  );
  assert.equal(application.status, 201);
  const submitted = await responseData<{ id: string }>(application);
  assert.equal(
    (await applicantApi(get(`/api/me/applications/${submitted.id}`))).status,
    200,
  );
  assert.equal(
    (await otherApi(get(`/api/me/applications/${submitted.id}`))).status,
    404,
  );

  const badJson = await applicantApi(
    new Request(`${appOrigin}/api/me/applications`, {
      method: "POST",
      headers: { origin: appOrigin, "content-type": "application/json" },
      body: "{",
    }),
  );
  assert.equal(badJson.status, 400);
  const badOrigin = await applicantApi(
    new Request(`${appOrigin}/api/me/applications`, {
      method: "POST",
      headers: {
        origin: "https://attacker.example",
        "content-type": "application/json",
      },
      body: "{}",
    }),
  );
  assert.equal(badOrigin.status, 403);

  const secret = "database-password-should-not-leak";
  const brokenApi = createApi({
    sql,
    currentUser: async () => {
      throw Object.assign(new Error(secret), { code: "08006" });
    },
    appUrl: appOrigin,
  });
  const logged: string[] = [];
  const oldConsoleError = console.error;
  console.error = (message?: unknown) => {
    logged.push(String(message));
  };
  try {
    const response = await brokenApi(get("/api/me/applications"));
    assert.equal(response.status, 503);
    const body = await response.text();
    assert.equal(body.includes(secret), false);
    assert.equal(logged.length, 1);
    assert.equal(logged[0].includes(secret), false);
  } finally {
    console.error = oldConsoleError;
  }
}

function get(path: string) {
  return new Request(`${appOrigin}${path}`, { method: "GET" });
}
function post(path: string, body: unknown) {
  return new Request(`${appOrigin}${path}`, {
    method: "POST",
    headers: { origin: appOrigin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
function put(path: string, body: unknown) {
  return new Request(`${appOrigin}${path}`, {
    method: "PUT",
    headers: { origin: appOrigin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
async function responseData<T>(response: Response): Promise<T> {
  return ((await response.json()) as { data: T }).data;
}

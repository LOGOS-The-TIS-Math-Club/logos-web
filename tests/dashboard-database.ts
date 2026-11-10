import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { createApi } from "../src/server/api.ts";
import { BackendError } from "../src/server/errors.ts";
import { academicYearAt } from "../src/membership/grade.ts";
import { tokyoDay } from "../src/dashboard/presentation.ts";
import {
  getOwnAttendanceSummary,
  acknowledgeAbsenceNotice,
} from "../src/attendance/operations.ts";
import { createSession, cancelSession } from "../src/sessions/calendar.ts";
import type { DashboardData, PersonalData } from "../src/dashboard/types.ts";

export async function verifyDashboard(sql: postgres.Sql) {
  const suffix = randomUUID();
  const [admin, student, other, applicant] = await sql<
    { id: string; email: string }[]
  >`insert into people.identities(email,school_verified)
    values (${`synthetic-dash-admin-${suffix}@tokyois.com`},true),(${`synthetic-dash-student-${suffix}@tokyois.com`},true),(${`synthetic-dash-other-${suffix}@tokyois.com`},true),(${`synthetic-dash-applicant-${suffix}@tokyois.com`},true) returning id,email`;
  await sql`insert into people.role_grants(identity_id,role) values (${admin.id},'admin'),(${student.id},'member'),(${other.id},'member')`;
  const origin = "http://localhost:3999";
  const lookup = (person: typeof student) => async () => {
    const [access] =
      await sql`select people.has_access(${person.id},'admin') as admin,people.has_access(${person.id},'member') as member`;
    return { ...person, admin: access.admin, member: access.member };
  };
  const apiFor = (person: typeof student, database = sql) =>
    createApi({ sql: database, appUrl: origin, currentUser: lookup(person) });
  const adminApi = apiFor(admin),
    api = apiFor(student),
    otherApi = apiFor(other);
  const get = (path: string) => new Request(origin + path);
  const post = (path: string, body: unknown) =>
    new Request(origin + path, {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  async function data<T>(response: Promise<Response>) {
    const result = await response;
    assert.equal(result.status, 200);
    assert.match(result.headers.get("Cache-Control")!, /no-store, private/);
    return (await result.json()).data as T;
  }
  const unauth = createApi({
    sql,
    appUrl: origin,
    currentUser: async () => {
      throw new BackendError("UNAUTHENTICATED", "Sign in.", 401);
    },
  });
  assert.equal((await unauth(get("/api/dashboard"))).status, 401);
  assert.equal((await apiFor(applicant)(get("/api/dashboard"))).status, 403);
  assert.equal(
    (await apiFor(applicant)(get("/api/calendar/hierarchy"))).status,
    403,
  );
  let initial = await data<DashboardData>(adminApi(get("/api/dashboard")));
  assert.equal(initial.calendar.status, "available");
  if (initial.calendar.status === "available")
    assert.equal(initial.calendar.data, null);
  assert.deepEqual(initial.personal.member, {
    status: "available",
    data: null,
  });
  assert.deepEqual(initial.personal.attendance, {
    status: "available",
    data: null,
  });
  const year = academicYearAt(new Date());
  async function ensureYear(start: number) {
    const [y] =
      await sql`insert into meetings.academic_years(name,start_year,starts_on,ends_on)
      values (${`Synthetic dashboard ${start}`},${start},${`${start}-08-01`}::date,${`${start + 1}-08-01`}::date) on conflict(start_year) do update set start_year=excluded.start_year returning id,start_year`;
    return y;
  }
  const current = await ensureYear(year);
  initial = await data<DashboardData>(adminApi(get("/api/dashboard")));
  if (initial.calendar.status !== "available" || !initial.calendar.data)
    throw Error("Calendar not readable");
  assert.equal(initial.calendar.data.term, null);
  assert.equal(initial.calendar.data.sessions.length, 0);
  for (const start of [year - 1, year, year + 1]) {
    const y = await ensureYear(start);
    await sql`insert into meetings.terms(academic_year_id,name,starts_on,ends_on) values (${y.id},'Synthetic autumn',${`${start}-08-01`}::date,${`${start + 1}-01-01`}::date),(${y.id},'Synthetic spring',${`${start + 1}-01-01`}::date,${`${start + 1}-08-01`}::date)`;
  }
  initial = await data<DashboardData>(adminApi(get("/api/dashboard")));
  if (initial.calendar.status !== "available" || !initial.calendar.data)
    throw Error("Missing calendar");
  assert.ok(initial.calendar.data.term);
  assert.equal(initial.calendar.data.sessions.length, 0);
  const date = (offset: number) =>
    tokyoDay(new Date(Date.now() + offset * 86400000));
  const [card, otherCard] =
    await sql`insert into members.memberships(identity_id,display_name,grade,grade_academic_year) values (${student.id},'Synthetic Dashboard Student',10,${year}),(${other.id},'Other private student',10,${year}) returning id`;
  for (const member of [card, otherCard])
    await sql`insert into members.state_changes(member_id,effective_on,status,recorded_by) values (${member.id},${date(-30)}::date,'active',${admin.id})`;
  await sql`insert into members.private_notes(member_id,notes) values (${card.id},'Hidden member notes')`;
  async function addSession(offset: number, title: string, folder?: string) {
    const on = date(offset);
    const [term] =
      await sql`select id from meetings.terms where starts_on<=${on}::date and ends_on>${on}::date`;
    return createSession(sql, admin.id, {
      id: randomUUID(),
      termId: term.id,
      date: on,
      startTime: "15:30",
      durationMinutes: 60,
      title,
      description: "Synthetic session description.",
      materialsFolderUrl: folder,
    });
  }
  const past = await addSession(-2, "Synthetic past session");
  const upcoming = await addSession(
    2,
    "Synthetic next session",
    "https://drive.google.com/drive/folders/synthetic_dashboard_materials",
  );
  const cancelled = await addSession(3, "Synthetic cancelled session");
  await cancelSession(sql, admin.id, cancelled.id, 1);
  await sql`insert into meetings.attendance(member_id,session_id,status,recorded_by,notes) values (${card.id},${past.id},'late',${admin.id},'Hidden attendance note'),(${otherCard.id},${past.id},'unexcused_absence',${admin.id},'Other private attendance note')`;
  const [otherNotice] =
    await sql`insert into meetings.absence_notices(member_id,session_date,reason,submitted_by) values (${otherCard.id},${date(2)}::date,'Other private reason',${other.id}) returning id`;
  await sql`insert into content.announcements(title,body,published_at) values ('Synthetic published announcement','Visible club update',now()),('Synthetic draft announcement','Hidden draft body',null)`;
  let dashboard = await data<DashboardData>(api(get("/api/dashboard")));
  assert.equal(dashboard.identityId, student.id);
  assert.equal(dashboard.nextSession.status, "available");
  if (dashboard.nextSession.status === "available")
    assert.equal(dashboard.nextSession.data?.id, upcoming.id);
  assert.equal(dashboard.hierarchy.status, "available");
  if (dashboard.hierarchy.status === "available")
    assert.equal(dashboard.hierarchy.data.academicYears.length, 3);
  const settled = await getOwnAttendanceSummary(sql, student.id);
  if (
    dashboard.personal.attendance.status !== "available" ||
    !dashboard.personal.attendance.data
  )
    throw Error("Missing personal records");
  assert.deepEqual(dashboard.personal.attendance.data.summary, settled.summary);
  assert.equal(
    dashboard.personal.attendance.data.records[0].session?.title,
    "Synthetic past session",
  );
  const serialized = JSON.stringify(dashboard);
  for (const secret of [
    other.email,
    other.id,
    "Other private reason",
    "Hidden member notes",
    "Hidden attendance note",
    "Hidden draft body",
    "created_by",
    "reviewed_by",
    "join_reason",
  ])
    assert.ok(!serialized.includes(secret), secret);
  const id = randomUUID(),
    notice = {
      requestId: id,
      sessionDate: date(2),
      reason: "Synthetic standalone absence",
    };
  const replays = await Promise.all([
    api(post("/api/me/absences", notice)),
    api(post("/api/me/absences", notice)),
  ]);
  for (const result of replays) {
    assert.equal(result.status, 201);
    assert.equal((await result.json()).data.id, id);
  }
  assert.equal(
    (
      await sql`select count(*)::int as n from meetings.absence_notices where id=${id}`
    )[0].n,
    1,
  );
  assert.equal(
    (
      await api(
        post("/api/me/absences", { ...notice, reason: "Changed reason" }),
      )
    ).status,
    409,
  );
  assert.equal((await otherApi(post("/api/me/absences", notice))).status, 409);
  assert.equal(
    (
      await api(
        post(`/api/me/absences/${otherNotice.id}/cancel`, { revision: 1 }),
      )
    ).status,
    404,
  );
  await acknowledgeAbsenceNotice(sql, admin.id, id, 1);
  assert.equal(
    (await api(post(`/api/me/absences/${id}/cancel`, { revision: 1 }))).status,
    409,
  );
  assert.equal(
    (await api(post(`/api/me/absences/${id}/cancel`, { revision: 2 }))).status,
    200,
  );
  const after = await data<PersonalData>(api(get("/api/dashboard/records")));
  if (after.notices.status !== "available" || !after.notices.data)
    throw Error("Missing notices");
  assert.equal(
    after.notices.data.find((n) => n.id === id)?.status,
    "cancelled",
  );
  assert.equal(
    (await (await api(post("/api/me/absences", notice))).json()).data.status,
    "cancelled",
  );
  assert.deepEqual(
    (await getOwnAttendanceSummary(sql, student.id)).summary,
    settled.summary,
  );
  const linked = {
    requestId: randomUUID(),
    sessionId: upcoming.id,
    reason: "Synthetic linked notice",
  };
  assert.equal((await api(post("/api/me/absences", linked))).status, 201);
  assert.equal(
    (
      await api(
        post("/api/me/absences", {
          ...linked,
          requestId: linked.requestId.toUpperCase(),
          sessionId: linked.sessionId.toUpperCase(),
        }),
      )
    ).status,
    201,
  );
  assert.equal(
    (
      await api(
        post("/api/me/absences", { ...linked, requestId: randomUUID() }),
      )
    ).status,
    409,
  );
  await sql`insert into members.state_changes(member_id,effective_on,status,recorded_by) values (${card.id},${date(0)}::date,'paused',${admin.id})`;
  dashboard = await data<DashboardData>(api(get("/api/dashboard")));
  if (dashboard.personal.member.status !== "available")
    throw Error("Missing member");
  assert.equal(dashboard.personal.member.data?.status, "paused");
  await sql`update members.state_changes set status='former',departure_reason='quit' where member_id=${card.id} and effective_on=${date(0)}::date`;
  assert.equal((await api(get("/api/dashboard"))).status, 403);
  assert.equal((await api(get("/api/dashboard/records"))).status, 403);
  assert.equal((await api(get(`/api/sessions/${upcoming.id}`))).status, 403);
  assert.equal(
    (await adminApi(get(`/api/sessions/${upcoming.id}`))).status,
    200,
  );
  await sql`update members.state_changes set status='active',departure_reason=null where member_id=${card.id} and effective_on=${date(0)}::date`;
  const partial = new Proxy(sql, {
    apply(target, thisArg, args) {
      const query = Array.isArray(args[0]) ? args[0].join("") : "";
      if (query.includes("content.announcements"))
        throw Error("Private infrastructure failure");
      return Reflect.apply(target, thisArg, args);
    },
  });
  const partiallyAvailable = await data<DashboardData>(
    apiFor(student, partial)(get("/api/dashboard")),
  );
  assert.equal(partiallyAvailable.announcements.status, "unavailable");
  assert.equal(partiallyAvailable.nextSession.status, "available");
  assert.ok(
    !JSON.stringify(partiallyAvailable).includes(
      "Private infrastructure failure",
    ),
  );
  assert.equal((await api(get("/api/dashboard/records/extra"))).status, 404);
  assert.equal((await api(get("/api/calendar/hierarchy/extra"))).status, 404);
  await sql`update people.identities set enabled=false where id=${student.id}`;
  assert.equal((await api(post("/api/me/absences", notice))).status, 403);
}

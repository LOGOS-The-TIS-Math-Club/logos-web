import { randomUUID } from "node:crypto";
import { configureTerm, assignSessionTerm } from "../src/sessions/calendar.ts";
import assert from "node:assert/strict";
import type postgres from "postgres";
import {
  submitApplication,
  acceptApplication,
} from "../src/applications/operations.ts";
import {
  getOwnApplications,
  getAdminMemberNotes,
  hasAccess,
} from "../src/access/operations.ts";
import {
  attendanceSummary,
  type AttendanceStatus,
} from "../src/attendance/summary.ts";

export async function verifyDatabase(sql: postgres.Sql) {
  const expectCode = async (promise: PromiseLike<unknown>, code: string) => {
    await assert.rejects(
      Promise.resolve(promise),
      (error: unknown) => (error as { code: string }).code === code,
    );
  };
  const [admin] =
    await sql`insert into people.identities(email,school_verified) values ('admin@example.invalid',false) returning id`;
  await sql`update people.identities set email = 'admin@tokyois.com', school_verified = true where id = ${admin.id}`;
  const [student] =
    await sql`insert into people.identities(email,school_verified) values ('student@tokyois.com',true) returning id`;
  const [other] =
    await sql`insert into people.identities(email,school_verified) values ('other@tokyois.com',true) returning id`;
  const [outsider] =
    await sql`insert into people.identities(email) values ('outsider@example.invalid') returning id`;
  await sql`insert into people.role_grants(identity_id,role) values (${admin.id},'admin')`;
  await expectCode(
    sql`insert into people.role_grants(identity_id,role) values (${student.id},'applicant')`,
    "23514",
  );
  await expectCode(
    sql`update people.identities set school_verified = true where id = ${outsider.id}`,
    "23514",
  );
  assert.equal(await hasAccess(sql, student.id, "admin"), false);
  assert.equal(await hasAccess(sql, admin.id, "admin"), true);
  assert.equal(await hasAccess(sql, student.id, "member"), false);
  const [year] =
    await sql`insert into meetings.academic_years(name,start_year,starts_on,ends_on) values ('2025–26',2025,'2025-08-01','2026-08-01') returning id`;
  const [term] =
    await sql`insert into meetings.terms(academic_year_id,name,starts_on,ends_on) values (${year.id},'Term 1','2025-08-01','2026-01-01') returning id`;
  await expectCode(
    sql`insert into meetings.terms(academic_year_id,name,starts_on,ends_on) values (${year.id},'Outside','2025-07-01','2025-08-02')`,
    "23514",
  );
  await expectCode(
    sql`insert into meetings.terms(academic_year_id,name,starts_on,ends_on) values (${year.id},'Overlap','2025-08-02','2025-09-02')`,
    "23514",
  );
  const [unassigned] =
    await sql`insert into meetings.sessions(academic_year_id,starts_at_local,duration_minutes,title) values (${year.id},'2026-02-01 15:30',60,'Unassigned historical session') returning id,term_id`;
  assert.equal(unassigned.term_id, null);
  const calendar = {
    id: randomUUID(),
    academicYearId: year.id,
    name: "Term 2",
    startsOn: "2026-01-01",
    endsOn: "2026-08-01",
  };
  await expectCode(configureTerm(sql, student.id, calendar), "42501");
  await configureTerm(sql, admin.id, calendar);
  await expectCode(
    assignSessionTerm(sql, student.id, unassigned.id, calendar.id),
    "42501",
  );
  await assignSessionTerm(sql, admin.id, unassigned.id, calendar.id);
  await expectCode(
    configureTerm(sql, admin.id, { ...calendar, endsOn: "2026-02-01" }),
    "23514",
  );
  assert.equal(
    (
      await sql`select term_id from meetings.sessions where id=${unassigned.id}`
    )[0].term_id,
    calendar.id,
  );
  const [nextYear] =
    await sql`insert into meetings.academic_years(name,start_year,starts_on,ends_on) values ('2026–27',2026,'2026-08-01','2027-08-01') returning id`;
  const nextCalendar = {
    id: randomUUID(),
    academicYearId: nextYear.id,
    name: "Term 1",
    startsOn: "2026-08-01",
    endsOn: "2027-01-01",
  };
  await configureTerm(sql, admin.id, nextCalendar);
  await expectCode(
    assignSessionTerm(sql, admin.id, unassigned.id, nextCalendar.id),
    "23514",
  );
  const input = {
    preferredName: "Test Student",
    grade: 9,
    gradeAcademicYear: 2025,
    academicInterests: ["algebra"],
    joinReason: "I want to explore mathematical ideas.",
    goals: "I want to learn together and solve problems.",
    contestInterest: "maybe",
    presentInterest: "yes",
    attendanceConfirmation: "regular",
    accuracyAcknowledged: true,
  };
  await expectCode(submitApplication(sql, outsider.id, input), "42501");
  const submissions = await Promise.allSettled([
    submitApplication(sql, student.id, input),
    submitApplication(sql, student.id, input),
  ]);
  assert.equal(submissions.filter((r) => r.status === "fulfilled").length, 1);
  const duplicate = submissions.find(
    (r) => r.status === "rejected",
  ) as PromiseRejectedResult;
  assert.equal(duplicate.reason.code, "23505");
  const app = (
    submissions.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<
      Awaited<ReturnType<typeof submitApplication>>
    >
  ).value;
  assert.equal((await getOwnApplications(sql, student.id)).length, 1);
  assert.equal((await getOwnApplications(sql, other.id)).length, 0);
  await expectCode(
    sql`update applications.submissions set status='accepted' where id=${app.id}`,
    "23514",
  );
  await sql`update people.identities set enabled=false where id=${admin.id}`;
  assert.equal(await hasAccess(sql, admin.id, "admin"), false);
  await sql`update people.identities set enabled=true where id=${admin.id}`;
  const card = {
    displayName: "Test Member",
    grade: 9,
    gradeAcademicYear: 2025,
    startsOn: "2025-08-10",
    privateNotes: "Private test note",
  };
  await expectCode(acceptApplication(sql, other.id, app.id, card), "42501");
  // Fail after member and notes writes, proving rollback across the entire workflow.
  await sql.unsafe(
    `create function operations.fail_test_history() returns trigger language plpgsql as $$ begin raise exception 'injected history failure'; end; $$; create trigger fail_test_history before insert on operations.change_history for each row execute function operations.fail_test_history();`,
  );
  await assert.rejects(acceptApplication(sql, admin.id, app.id, card));
  assert.equal((await sql`select id from members.memberships`).length, 0);
  assert.equal(
    (
      await sql`select status from applications.submissions where id=${app.id}`
    )[0].status,
    "submitted",
  );
  assert.equal(
    (
      await sql`select * from people.role_grants where identity_id=${student.id}`
    ).length,
    0,
  );
  await sql.unsafe(
    "drop trigger fail_test_history on operations.change_history; drop function operations.fail_test_history();",
  );
  const accepted = await Promise.all([
    acceptApplication(sql, admin.id, app.id, card),
    acceptApplication(sql, admin.id, app.id, card),
  ]);
  const member = accepted[0];
  assert.equal(accepted[1], member);
  assert.equal((await sql`select * from members.memberships`).length, 1);
  assert.equal(
    (
      await sql`select * from operations.change_history where action='application.accepted'`
    ).length,
    1,
  );
  assert.equal(await hasAccess(sql, student.id, "member"), true);
  await expectCode(getAdminMemberNotes(sql, student.id, member), "42501");
  assert.equal(
    await getAdminMemberNotes(sql, admin.id, member),
    "Private test note",
  );
  await sql`update people.identities set school_verified=false where id=${student.id}`;
  assert.equal(await hasAccess(sql, student.id, "member"), false);
  await sql`update people.identities set school_verified=true where id=${student.id}`;
  const roster = (await sql`select * from members.active_roster`)[0];
  assert.equal("notes" in roster, false);
  await expectCode(submitApplication(sql, student.id, input), "23514");
  await expectCode(
    sql`select applications.transition(${admin.id},${app.id},'rejected')`,
    "23514",
  );
  await sql`insert into content.leadership_profiles(member_id,display_name,title) values (${member},'Test','President')`;
  assert.equal(await hasAccess(sql, student.id, "admin"), false);
  await sql`select members.change_state(${admin.id},${member},'2025-08-20','paused')`;
  assert.equal(await hasAccess(sql, student.id, "member"), true);
  await sql`select members.change_state(${admin.id},${member},'2025-09-01','active')`;
  await sql`select members.change_state(${admin.id},${member},'2025-09-10','former','quit')`;
  assert.equal(await hasAccess(sql, student.id, "member"), false);
  await expectCode(
    sql`delete from members.memberships where id=${member}`,
    "23001",
  );
  // Former members can apply again; rejected and withdrawn submissions do not ban.
  const again = await submitApplication(sql, student.id, input);
  await sql`select applications.transition(${admin.id},${again.id},'under_review')`;
  await sql`select applications.transition(${admin.id},${again.id},'rejected')`;
  const withdrawn = await submitApplication(sql, student.id, input);
  await sql`select applications.transition(${student.id},${withdrawn.id},'withdrawn')`;
  await sql`insert into applications.reapplication_restrictions(identity_id,reason,recorded_by) values (${student.id},'Temporary restriction',${admin.id})`;
  await expectCode(submitApplication(sql, student.id, input), "23514");
  await sql`delete from applications.reapplication_restrictions where identity_id=${student.id}`;
  const rejoin = await submitApplication(sql, student.id, input);
  assert.equal(
    await acceptApplication(sql, admin.id, rejoin.id, {
      ...card,
      startsOn: "2025-09-20",
    }),
    member,
  );
  assert.equal((await sql`select * from members.memberships`).length, 1);
  assert.equal((await getOwnApplications(sql, student.id)).length, 4);

  const makeSession = async (
    date: string,
    status = "scheduled",
    duration = 60,
  ) => {
    const [s] =
      await sql`insert into meetings.sessions(term_id,starts_at_local,duration_minutes,title,status)
      values (${term.id},${date}::text::timestamp,${duration},'Test session',${status}) returning id`;
    return s.id as string;
  };
  await expectCode(makeSession("2026-01-01 15:00"), "23514");
  await expectCode(makeSession("2025-10-01 15:00", "scheduled", 0), "23514");
  await makeSession("2025-08-09 15:00"); // before joining
  const present = await makeSession("2025-08-10 15:00"); // joining day
  await makeSession("2025-08-20 15:00"); // pause effective day
  const late = await makeSession("2025-09-01 15:00"); // resume effective day
  await makeSession("2025-09-10 15:00"); // departure effective day
  await makeSession("2025-09-19 15:00"); // gap before rejoining
  const excused = await makeSession("2025-09-20 15:00");
  const absent = await makeSession("2025-09-21 15:00");
  await makeSession("2025-09-22 15:00"); // pending
  await makeSession("2025-09-23 15:00", "cancelled");
  await makeSession("2025-09-24 15:00"); // in progress at as-of
  await makeSession("2025-10-01 15:00"); // future
  for (const [id, status] of [
    [present, "present"],
    [late, "late"],
    [excused, "excused_absence"],
    [absent, "unexcused_absence"],
  ]) {
    await sql`select meetings.record_attendance(${admin.id},${member},${id!},${status!})`;
  }
  await expectCode(
    sql`select meetings.record_attendance(${student.id},${member},${present},'present')`,
    "42501",
  );
  await expectCode(
    sql`insert into meetings.attendance(member_id,session_id,status,recorded_by) values (${member},${present},'late',${admin.id})`,
    "23505",
  );
  await sql`select meetings.record_attendance(${admin.id},${member},${present},'late')`;
  await sql`select meetings.record_attendance(${admin.id},${member},${present},'present')`;
  const eligible = await sql<
    { session_id: string; status: AttendanceStatus }[]
  >`select * from meetings.eligible_attendance(${member},'2025-09-24T06:30:00Z')`;
  const summary = attendanceSummary(eligible);
  assert.equal(summary.eligibleSessions, 5);
  assert.equal(summary.denominator, 3);
  assert.equal(summary.percentage, 67);
  assert.equal(summary.pending, 1);
  assert.equal(
    (
      await sql`select * from meetings.eligible_attendance(${member},'2025-09-24T07:00:00Z')`
    ).length,
    6,
  );
  await sql`insert into meetings.absence_notices(member_id,session_id,reason,submitted_by) values (${member},${present},'Notice only',${student.id})`;
  assert.equal(
    (
      await sql`select status from meetings.attendance where member_id=${member} and session_id=${present}`
    )[0].status,
    "present",
  );
  const [time] =
    await sql`select starts_at = '2025-08-10T06:00:00Z'::timestamptz as correct from meetings.session_times where id=${present}`;
  assert.equal(time.correct, true);
  await sql`insert into content.stories(title,occurred_on) values ('No description','2025-10-01')`;
  assert.equal(
    (await sql`select description from content.stories`)[0].description,
    "",
  );
  // An imported member does not need an application or a linked auth account.
  await sql`insert into members.memberships(identity_id,display_name,grade,grade_academic_year) values (${other.id},'Imported',10,2025)`;
  console.log(
    "Passed: access, own records, private notes, application transitions/reapplications, concurrent submission/acceptance, rollback, membership history, attendance, ranges, content, imports.",
  );
}

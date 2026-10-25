import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { academicYearAt } from "../src/membership/grade.ts";
import {
  acknowledgeAbsenceNotice,
  cancelAbsenceNotice,
  createAbsenceNotice,
  getOwnAbsenceNotices,
  getOwnAttendanceSummary,
  getSessionAttendance,
  saveSessionAttendance,
} from "../src/attendance/operations.ts";
import {
  cancelSession,
  createAcademicYear,
  createSession,
  createTerm,
  getCurrentCalendar,
  getSessionDetail,
  getSessionsByAcademicYear,
  getSessionsByTerm,
  getUpcomingSessions,
  updateSession,
  updateAcademicYear,
  updateTerm,
} from "../src/sessions/calendar.ts";

export async function verifyMeetings(sql: postgres.Sql) {
  const suffix = randomUUID().slice(0, 8);
  const [admin] = await sql`insert into people.identities(email,school_verified)
    values (${`admin-${suffix}@tokyois.com`},true) returning id`;
  const [student] = await sql`insert into people.identities(email,school_verified)
    values (${`student-${suffix}@tokyois.com`},true) returning id`;
  const [outsider] = await sql`insert into people.identities(email)
    values (${`outsider-${suffix}@example.invalid`}) returning id`;
  await sql`insert into people.role_grants(identity_id,role) values (${admin.id},'admin'),(${student.id},'member')`;
  const yearInput = {
    id: randomUUID(), name: `Meetings ${suffix}`, startYear: 2027,
    startsOn: '2027-08-01', endsOn: '2028-08-01',
  };
  await expectFailure(() => createAcademicYear(sql, outsider.id, yearInput), '42501');
  await expectFailure(() => createAcademicYear(sql, admin.id, {
    ...yearInput, id: randomUUID(), startsOn: '2027-07-31',
  }), '23514');
  const year = await createAcademicYear(sql, admin.id, yearInput);
  assert.equal(year.revision, 1);
  const updatedYear = await updateAcademicYear(sql, admin.id, year.revision, {
    ...yearInput, name: `Updated ${suffix}`,
  });
  assert.equal(updatedYear.revision, 2);
  await expectFailure(() => updateAcademicYear(sql, admin.id, year.revision, {
    ...yearInput, name: `Stale ${suffix}`,
  }), 'CONFLICT');
  const termInput = {
    id: randomUUID(), academicYearId: year.id, name: 'Term',
    startsOn: '2027-08-01', endsOn: '2028-08-01',
  };
  await expectFailure(() => createTerm(sql, outsider.id, termInput), '42501');
  await expectFailure(() => createTerm(sql, admin.id, {
    ...termInput, id: randomUUID(), startsOn: '2027-07-01', endsOn: '2027-09-01',
  }), '23514');
  const term = await createTerm(sql, admin.id, termInput);
  assert.equal(term.revision, 1);
  const updatedTerm = await updateTerm(sql, admin.id, term.revision, {
    ...termInput, name: 'Renamed term',
  });
  assert.equal(updatedTerm.revision, 2);
  await expectFailure(() => updateTerm(sql, admin.id, term.revision, {
    ...termInput, name: 'Stale term',
  }), 'CONFLICT');
  const [member] = await sql`insert into members.memberships(identity_id,display_name,grade,grade_academic_year)
    values (${student.id},'Student',9,2027) returning id`;
  await sql`insert into members.state_changes(member_id,effective_on,status,recorded_by)
    values (${member.id},'2026-08-15','active',${admin.id})`;
  await sql`insert into members.state_changes(member_id,effective_on,status,recorded_by)
    values (${member.id},'2027-08-10','paused',${admin.id}),(${member.id},'2027-08-15','active',${admin.id})`;

  const a = await createSession(sql, admin.id, {
    id: randomUUID(), termId: term.id, date: '2027-08-20', startTime: '15:00',
    durationMinutes: 60, title: 'Session A',
  });
  const b = await createSession(sql, admin.id, {
    id: randomUUID(), termId: term.id, date: '2027-08-10', startTime: '15:00',
    durationMinutes: 60, title: 'Session B',
  });
  assert.equal((await getSessionsByAcademicYear(sql, admin.id, year.id)).length, 2);
  assert.equal((await getSessionsByTerm(sql, admin.id, term.id)).length, 2);
  assert.equal((await getSessionsByAcademicYear(sql, student.id, year.id)).length, 2);
  assert.equal((await getSessionsByTerm(sql, student.id, term.id)).length, 2);
  const sessionDetail = await getSessionDetail(sql, student.id, a.id);
  assert.equal(sessionDetail.title, 'Session A');
  assert.equal(new Date(sessionDetail.ends_at).toISOString(), '2027-08-20T07:00:00.000Z');
  const currentYear = academicYearAt(new Date());
  const currentYearRecord = await sql`select id,starts_on,ends_on from meetings.academic_years where start_year=${currentYear}`;
  let currentYearId = currentYearRecord[0]?.id as string | undefined;
  if (!currentYearRecord.length) {
    const startsOn = `${currentYear}-08-01`;
    const endsOn = `${currentYear + 1}-08-01`;
    const currentYearCreated = await createAcademicYear(sql, admin.id, {
      id: randomUUID(), name: `Current ${suffix}`, startYear: currentYear, startsOn, endsOn,
    });
    currentYearId = currentYearCreated.id;
  }
  assert(currentYearId);
  const today = tokyoDate(new Date());
  const [termToday] = await sql`select id from meetings.terms where academic_year_id=${currentYearId}
    and starts_on <= ${today}::text::date and ends_on > ${today}::text::date`;
  if (!termToday) {
    const [yearRow] = await sql`select ends_on from meetings.academic_years where id=${currentYearId}`;
    const [nextTerm] = await sql`select starts_on from meetings.terms
      where academic_year_id=${currentYearId} and starts_on>${today}::text::date
      order by starts_on limit 1`;
    const currentTermEnd = databaseDate(nextTerm?.starts_on ?? yearRow.ends_on);
    await createTerm(sql, admin.id, {
      id: randomUUID(), academicYearId: currentYearId,
      name: `Current term ${suffix}`, startsOn: today, endsOn: currentTermEnd,
    });
  }
  const currentCalendar = await getCurrentCalendar(sql, admin.id);
  assert.equal(currentCalendar?.academicYear.start_year, currentYear);
  assert(currentCalendar?.term);
  assert(databaseDate(currentCalendar.term.starts_on) <= today && databaseDate(currentCalendar.term.ends_on) > today);
  await expectFailure(() => getSessionDetail(sql, outsider.id, a.id), 'FORBIDDEN');

  const initial = await getSessionAttendance(sql, admin.id, a.id);
  assert.equal(initial.sessionRevision, a.revision);
  assert.deepEqual(initial.roster.map((r) => r.memberId as string), [member.id]);
  const saved = await saveSessionAttendance(sql, admin.id, a.id, a.revision, [
    { memberId: member.id, status: 'present' },
  ]);
  assert.equal(saved.revision, a.revision + 1);
  const beforeBatchFailure = await getSessionAttendance(sql, admin.id, a.id);
  const firstStatusBeforeFailure = beforeBatchFailure.roster[0].status;
  const attendanceRevisionBeforeFailure = beforeBatchFailure.roster[0].attendanceRevision;
  await expectFailure(() => saveSessionAttendance(sql, admin.id, a.id, beforeBatchFailure.sessionRevision, [
    { memberId: member.id, status: 'late' },
    { memberId: outsider.id, status: 'present' },
  ]), 'INVALID_STATE');
  const afterBatchFailure = await getSessionAttendance(sql, admin.id, a.id);
  assert.equal(afterBatchFailure.sessionRevision, beforeBatchFailure.sessionRevision);
  assert.equal(afterBatchFailure.roster[0].status, firstStatusBeforeFailure);
  assert.equal(afterBatchFailure.roster[0].attendanceRevision, attendanceRevisionBeforeFailure);
  const own = await getOwnAttendanceSummary(sql, student.id, '2027-08-20T07:00:00Z');
  assert.equal(own.summary.percentage, 100);

  // Racing saves with the same expected session version cannot both commit.
  const current = await getSessionAttendance(sql, admin.id, a.id);
  const racing = await Promise.allSettled([
    saveSessionAttendance(sql, admin.id, a.id, current.sessionRevision, [
      { memberId: member.id, status: 'late' },
    ]),
    saveSessionAttendance(sql, admin.id, a.id, current.sessionRevision, [
      { memberId: member.id, status: 'excused_absence' },
    ]),
  ]);
  assert.equal(racing.filter((r) => r.status === 'fulfilled').length, 1);
  assert.equal(racing.filter((r) => r.status === 'rejected').length, 1);
  const postRace = await getSessionAttendance(sql, admin.id, a.id);
  await expectFailure(() => saveSessionAttendance(sql, outsider.id, a.id, current.sessionRevision + 1, [
    { memberId: member.id, status: 'present' },
  ]), '42501');

  // Session B predates the member's active period, so new records are rejected.
  const beforeJoinAttendance = await getSessionAttendance(sql, admin.id, b.id);
  assert.equal(beforeJoinAttendance.roster.length, 0);
  await expectFailure(() => saveSessionAttendance(sql, admin.id, b.id, b.revision, [
    { memberId: member.id, status: 'present' },
  ]), 'INVALID_STATE');
  await sql`insert into meetings.attendance(member_id,session_id,status,recorded_by)
    values (${member.id},${b.id},'present',${admin.id})`;
  const historical = await getSessionAttendance(sql, admin.id, b.id);
  assert.equal(historical.roster.length, 1);
  assert.equal(historical.roster[0].eligible, false);
  assert.equal(historical.roster[0].status, 'present');
  const corrected = await saveSessionAttendance(sql, admin.id, b.id, historical.sessionRevision, [
    { memberId: member.id, status: 'late' },
  ]);
  assert.equal(corrected.changed, 1);

  const notice = await createAbsenceNotice(sql, student.id, {
    sessionId: a.id,
    reason: 'Will arrive late',
  });
  assert.equal(notice.revision, 1);
  assert.equal((await getOwnAbsenceNotices(sql, student.id)).length, 1);
  assert.equal((await getSessionAttendance(sql, admin.id, a.id)).roster[0].notices.length, 1);
  const acknowledged = await acknowledgeAbsenceNotice(sql, admin.id, notice.id, notice.revision);
  assert.equal(acknowledged.status, 'acknowledged');
  await expectFailure(() => cancelAbsenceNotice(sql, student.id, notice.id, notice.revision), 'CONFLICT');
  const standalone = await createAbsenceNotice(sql, student.id, {
    sessionDate: '2027-08-21', reason: 'Conflict on this date',
  });
  const cancelledNotice = await cancelAbsenceNotice(sql, student.id, standalone.id, standalone.revision);
  assert.equal(cancelledNotice.status, 'cancelled');
  await expectFailure(() => createAbsenceNotice(sql, outsider.id, {
    sessionDate: '2026-08-21', reason: 'No membership',
  }), 'FORBIDDEN');

  const updated = await updateSession(sql, admin.id, a.id, postRace.sessionRevision, {
    termId: term.id, date: '2027-08-20', startTime: '16:00',
    durationMinutes: 75, title: 'Session A updated',
  });
  assert.equal(updated.revision, postRace.sessionRevision + 1);
  await expectFailure(() => updateSession(sql, admin.id, a.id, postRace.sessionRevision, {
    termId: term.id, date: '2027-08-20', startTime: '16:00',
    durationMinutes: 75, title: 'Stale update',
  }), 'CONFLICT');
  const cancelled = await cancelSession(sql, admin.id, a.id, updated.revision);
  assert.equal(cancelled.revision, updated.revision + 1);
  await expectFailure(() => saveSessionAttendance(sql, admin.id, a.id, cancelled.revision, [
    { memberId: outsider.id, status: 'present' },
  ]), 'INVALID_STATE');
  assert.equal((await getUpcomingSessions(sql, admin.id)).every((s) => s.status === 'scheduled'), true);
}

async function expectFailure(action: () => Promise<unknown>, code: string) {
  await assert.rejects(action(), (error: unknown) => {
    const e = error as { code?: string; cause?: { code?: string } };
    return e.code === code || e.cause?.code === code;
  });
}

function tokyoDate(instant: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

function databaseDate(value: string | Date) {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value;
}

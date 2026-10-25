import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type postgres from "postgres";
import { BackendError } from "../src/server/errors.ts";
import { academicYearAt } from "../src/membership/grade.ts";
import {
  acceptApplicationReview,
  getAdminApplicationDetail,
  getOwnApplicationDetail,
  listApplicationQueue,
  transitionApplication,
  withdrawOwnApplication,
} from "../src/applications/review.ts";
import {
  changeMembershipState,
  createReapplicationRestriction,
  endReapplicationRestriction,
  getAdminMemberDetail,
  getOwnMemberDetail,
  grantAdmin,
  listMembers,
  revokeAdmin,
  updateMemberCard,
} from "../src/membership/operations.ts";

function expectBackendError(code: string) {
  return (error: unknown) => error instanceof BackendError && error.code === code;
}

/** Database integration coverage for owner/admin visibility and membership revision operations. */
export async function verifyMembership(sql: postgres.Sql) {
  const suffix = randomUUID().slice(0, 8);
  const [admin] = await sql`insert into people.identities(email, school_verified)
    values (${`membership-admin-${suffix}@tokyois.com`}, true) returning id`;
  const [secondAdmin] = await sql`insert into people.identities(email, school_verified)
    values (${`membership-admin-2-${suffix}@tokyois.com`}, true) returning id`;
  const [student] = await sql`insert into people.identities(email, school_verified)
    values (${`membership-student-${suffix}@tokyois.com`}, true) returning id`;
  const [withdrawalStudent] = await sql`insert into people.identities(email, school_verified)
    values (${`membership-withdrawal-${suffix}@tokyois.com`}, true) returning id`;
  await sql`insert into people.role_grants(identity_id, role) values (${admin.id}, 'admin'), (${secondAdmin.id}, 'admin')`;
  const gradeYear = academicYearAt(new Date());
  await sql`insert into meetings.academic_years(name,start_year,starts_on,ends_on)
    values (${`membership-test-${gradeYear}`},${gradeYear},${`${gradeYear}-08-01`}::date,${`${gradeYear + 1}-08-01`}::date)
    on conflict(start_year) do nothing`;
  const dateParts = Object.fromEntries(new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date()).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const tomorrow = new Date(`${today}T00:00:00+09:00`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const tomorrowParts = Object.fromEntries(new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(tomorrow).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const tomorrowDate = `${tomorrowParts.year}-${tomorrowParts.month}-${tomorrowParts.day}`;

  const input = {
    preferredName: "Membership Test",
    grade: 10,
    gradeAcademicYear: gradeYear,
    academicInterests: ["algebra"],
    joinReason: "I want to learn more mathematics with a supportive group.",
    goals: "I want to practice solving problems and explain my ideas.",
    experience: "Some school mathematics.",
    mathCourse: "myp_extended",
    contestInterest: "maybe",
    presentInterest: "yes",
    attendanceConfirmation: "regular",
    accuracyAcknowledged: true,
  };
  const [application] = await sql`insert into applications.submissions(identity_id,
      preferred_name, grade, grade_academic_year, academic_interests, join_reason, goals,
      experience, math_course, contest_interest, present_interest, attendance_confirmation,
      accuracy_acknowledged)
    values (${student.id}, ${input.preferredName}, ${input.grade}, ${input.gradeAcademicYear},
      ${sql.array(input.academicInterests)}, ${input.joinReason}, ${input.goals}, ${input.experience},
      ${input.mathCourse}, ${input.contestInterest}, ${input.presentInterest},
      ${input.attendanceConfirmation}, true) returning id`;
  const [withdrawalApplication] = await sql`insert into applications.submissions(identity_id,
      preferred_name, grade, grade_academic_year, academic_interests, join_reason, goals,
      experience, math_course, contest_interest, present_interest, attendance_confirmation,
      accuracy_acknowledged)
    values (${withdrawalStudent.id}, ${input.preferredName}, ${input.grade}, ${input.gradeAcademicYear},
      ${sql.array(input.academicInterests)}, ${input.joinReason}, ${input.goals}, ${input.experience},
      ${input.mathCourse}, ${input.contestInterest}, ${input.presentInterest},
      ${input.attendanceConfirmation}, true) returning id`;

  assert.equal((await listApplicationQueue(sql, admin.id, { query: "Membership Test" })).some((row) => row.id === application.id), true);
  await assert.rejects(listApplicationQueue(sql, student.id), (error: unknown) => (error as { code?: string }).code === "42501");
  const ownerDetail = await getOwnApplicationDetail(sql, student.id, application.id);
  assert.equal(ownerDetail.application.join_reason, input.joinReason);
  assert.equal("reviewed_by" in ownerDetail.application, false);
  assert.equal("status_reason" in ownerDetail.application, false);
  await assert.rejects(withdrawOwnApplication(sql, student.id, withdrawalApplication.id, 1), expectBackendError("NOT_FOUND"));
  const withdrawn = await withdrawOwnApplication(sql, withdrawalStudent.id, withdrawalApplication.id, 1);
  assert.equal(withdrawn.status, "withdrawn");
  assert.equal(withdrawn.revision, 2);
  await assert.rejects(getOwnApplicationDetail(sql, student.id, randomUUID()), expectBackendError("NOT_FOUND"));
  await transitionApplication(sql, admin.id, application.id, 1, "under_review");
  await assert.rejects(transitionApplication(sql, admin.id, application.id, 1, "rejected"), expectBackendError("CONFLICT"));
  const review = await getAdminApplicationDetail(sql, admin.id, application.id);
  assert.equal(review.application.join_reason, input.joinReason);
  assert.equal("reviewed_by" in review.application, true);

  const card = {
    displayName: "Membership Test",
    grade: 10,
    gradeAcademicYear: gradeYear,
    startsOn: today,
    privateNotes: "Private review note",
  };
  const memberId = await acceptApplicationReview(sql, admin.id, application.id, 2, card);
  assert.equal(await acceptApplicationReview(sql, admin.id, application.id, 2, card), memberId);
  assert.deepEqual((await listMembers(sql, admin.id)).map((row) => row.id), [memberId]);
  const adminMember = await getAdminMemberDetail(sql, admin.id, memberId);
  assert.equal(adminMember.private.notes, card.privateNotes);
  assert.equal(adminMember.applications[0].join_reason, input.joinReason);
  const ownMember = await getOwnMemberDetail(sql, student.id);
  assert.equal(ownMember.member.id, memberId);
  assert.equal(ownMember.member.currentGradeAcademicYear, gradeYear);
  assert.equal("private" in ownMember, false);
  assert.equal("status_reason" in ownMember.applications[0], false);

  const edited = await updateMemberCard(sql, admin.id, memberId, 1, {
    displayName: "Updated Test Member",
    grade: 10,
    gradeAcademicYear: gradeYear,
    privateNotes: "Updated private note",
  });
  assert.equal(edited.revision, 2);
  await assert.rejects(updateMemberCard(sql, admin.id, memberId, 1, {
    displayName: "Stale Update", grade: 10, gradeAcademicYear: gradeYear,
  }), expectBackendError("CONFLICT"));
  const state = await changeMembershipState(sql, admin.id, memberId, 2, {
    effectiveOn: tomorrowDate, status: "paused",
  });
  assert.equal(state.revision, 3);
  await assert.rejects(changeMembershipState(sql, admin.id, memberId, 2, {
    effectiveOn: today, status: "active",
  }), expectBackendError("CONFLICT"));

  const restriction = await createReapplicationRestriction(sql, admin.id, student.id, {
    reason: "Temporary reapplication pause",
  });
  const restrictedOwner = await getOwnApplicationDetail(sql, student.id, application.id);
  assert.equal(restrictedOwner.reapplicationRestricted, true);
  const adminWithRestriction = await getAdminApplicationDetail(sql, admin.id, application.id);
  assert.equal(adminWithRestriction.restrictions[0].reason, "Temporary reapplication pause");
  await endReapplicationRestriction(sql, admin.id, restriction.id);
  assert.equal((await getOwnApplicationDetail(sql, student.id, application.id)).reapplicationRestricted, false);

  const [newAdmin] = await sql`insert into people.identities(email, school_verified)
    values (${`membership-admin-3-${suffix}@tokyois.com`}, true) returning id`;
  assert.equal((await grantAdmin(sql, admin.id, newAdmin.id)).granted, true);
  assert.equal((await revokeAdmin(sql, admin.id, newAdmin.id)).revoked, true);
  await revokeAdmin(sql, admin.id, secondAdmin.id);
  const [adminCount] = await sql`select count(*)::int as count from people.role_grants r
    join people.identities i on i.id=r.identity_id where r.role='admin' and i.enabled and i.school_verified`;
  if (adminCount.count === 1) {
    await assert.rejects(revokeAdmin(sql, admin.id, admin.id), expectBackendError("INVALID_STATE"));
  }
  await assert.rejects(listMembers(sql, student.id), (error: unknown) => (error as { code?: string }).code === "42501");
}

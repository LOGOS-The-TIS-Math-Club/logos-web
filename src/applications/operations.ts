import type postgres from "postgres";
import { z } from "zod";
import { applicationInput, memberCardInput } from "./input.ts";

// actorId must come from the server current-user lookup, never request JSON.
export async function submitApplication(
  sql: postgres.Sql,
  actorId: string,
  raw: unknown,
) {
  const person = z.uuid().parse(actorId);
  const v = applicationInput.parse(raw);
  const [row] = await sql`
    insert into applications.submissions(identity_id, preferred_name, grade, grade_academic_year,
      academic_interests, join_reason, goals, experience, math_course, contest_interest,
      present_interest, attendance_confirmation, accuracy_acknowledged)
    values (${person}, ${v.preferredName}, ${v.grade}, ${v.gradeAcademicYear},
      ${sql.array(v.academicInterests)}, ${v.joinReason}, ${v.goals}, ${v.experience},
      ${v.mathCourse}, ${v.contestInterest}, ${v.presentInterest}, ${v.attendanceConfirmation}, true)
    returning id, status, submitted_at`;
  return row;
}

export async function acceptApplication(
  sql: postgres.Sql,
  actorId: string,
  applicationId: string,
  raw: unknown,
): Promise<string> {
  const actor = z.uuid().parse(actorId);
  const application = z.uuid().parse(applicationId);
  const v = memberCardInput.parse(raw);
  const [row] =
    await sql`select applications.accept(${actor}, ${application}, ${v.displayName},
    ${v.grade}, ${v.gradeAcademicYear}, ${v.startsOn}::text::date, ${v.privateNotes}) as member_id`;
  return row.member_id;
}

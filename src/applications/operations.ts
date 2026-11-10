import type postgres from "postgres";
import { z } from "zod";
import { applicationInput, memberCardInput } from "./input.ts";
import { isDeepStrictEqual } from "node:util";
import { BackendError } from "../server/errors.ts";

// actorId must come from the server current-user lookup, never request JSON.
export async function submitApplication(
  sql: postgres.Sql,
  actorId: string,
  raw: unknown,
) {
  const person = z.uuid().parse(actorId);
  const v = applicationInput.parse(raw);
  const { requestId } = z.object({ requestId: z.uuid().optional() }).parse(raw);
  return sql.begin(async (tx) => {
    const [identity] =
      await tx`select id from people.identities where id=${person} and enabled and school_verified for update`;
    // Without a verified identity, fall through to the existing database guard.
    // In particular, a replay must never bypass disabled-account protection.
    if (requestId && identity) {
      const [existing] =
        await tx`select * from applications.submissions where id=${requestId}`;
      if (existing) {
        const original =
          existing.identity_id === person
            ? applicationInput.parse({
                preferredName: existing.preferred_name,
                grade: existing.grade,
                gradeAcademicYear: existing.grade_academic_year,
                academicInterests: existing.academic_interests,
                joinReason: existing.join_reason,
                goals: existing.goals,
                experience: existing.experience,
                mathCourse: existing.math_course,
                contestInterest: existing.contest_interest,
                presentInterest: existing.present_interest,
                attendanceConfirmation: existing.attendance_confirmation,
                accuracyAcknowledged: existing.accuracy_acknowledged,
              })
            : null;
        if (!isDeepStrictEqual(original, v))
          throw new BackendError(
            "CONFLICT",
            "This submission ID has already been used. Check your application status before starting a new application.",
            409,
          );
        // Answers are immutable. A retry returns this application's current status,
        // even if review completed after a response was lost.
        return {
          id: existing.id,
          status: existing.status,
          submitted_at: existing.submitted_at,
        };
      }
    }
    const [row] = await tx`
    insert into applications.submissions(id, identity_id, preferred_name, grade, grade_academic_year,
      academic_interests, join_reason, goals, experience, math_course, contest_interest,
      present_interest, attendance_confirmation, accuracy_acknowledged)
    values (coalesce(${requestId ?? null}::uuid,gen_random_uuid()), ${person}, ${v.preferredName}, ${v.grade}, ${v.gradeAcademicYear},
      ${tx.array(v.academicInterests)}, ${v.joinReason}, ${v.goals}, ${v.experience},
      ${v.mathCourse}, ${v.contestInterest}, ${v.presentInterest}, ${v.attendanceConfirmation}, true)
    returning id, status, submitted_at`;
    return row;
  });
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

import type postgres from "postgres";
import { z } from "zod";
import { BackendError } from "../server/errors.ts";
import type { ApplicationEntry, OwnApplication } from "./presentation.ts";

export async function getOwnApplicationEntry(
  sql: postgres.Sql,
  actorId: string,
): Promise<ApplicationEntry> {
  const actor = z.uuid().parse(actorId);
  return sql.begin("isolation level repeatable read read only", async (tx) => {
    const [identity] =
      await tx`select id,email from people.identities where id=${actor} and enabled and school_verified`;
    if (!identity)
      throw new BackendError(
        "FORBIDDEN",
        "Verified school access is required.",
        403,
      );
    const [year] = await tx`select start_year,name from meetings.academic_years
      where starts_on <= (now() at time zone 'Asia/Tokyo')::date and ends_on > (now() at time zone 'Asia/Tokyo')::date`;
    const [eligibility] =
      await tx`select applications.submission_blocker(${actor}) as blocker`;
    const rows =
      await tx`select id,preferred_name,grade,grade_academic_year,academic_interests,
      join_reason,goals,experience,math_course,contest_interest,present_interest,
      attendance_confirmation,accuracy_acknowledged,status,submitted_at,status_updated_at,revision,
      status in ('submitted','under_review') as "canWithdraw"
      from applications.submissions where identity_id=${actor} order by submitted_at desc,id desc`;
    return {
      identityId: identity.id,
      email: identity.email,
      academicYear: year
        ? { startYear: year.start_year, name: year.name }
        : null,
      blockedBy: eligibility.blocker,
      applications: rows.map((row) => ({
        ...row,
        submitted_at: row.submitted_at.toISOString(),
        status_updated_at: row.status_updated_at.toISOString(),
      })) as OwnApplication[],
    };
  });
}

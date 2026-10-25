import type postgres from "postgres";
import { z } from "zod";
import { BackendError } from "../server/errors.ts";
import { memberCardInput } from "./input.ts";

const uuid = (value: string) => z.uuid().parse(value);
type Tx = postgres.TransactionSql;
const revisionInput = z.number().int().positive();
const reviewStatus = z.enum(["submitted", "under_review", "accepted", "rejected", "withdrawn"]);
const queueInput = z.object({
  status: z.enum(["submitted", "under_review", "accepted", "rejected", "withdrawn", "all"]).default("submitted"),
  query: z.string().trim().max(120).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(10000).default(0),
});

async function requireAdmin(tx: Tx, actor: string) {
  await tx`select people.require_admin(${actor})`;
}

async function lockApplication(tx: Tx, applicationId: string) {
  const [identity] = await tx`select identity_id from applications.submissions where id=${applicationId}`;
  if (!identity) throw new BackendError("NOT_FOUND", "Application was not found", 404);
  // Match applications.accept's identity-then-application lock order.
  await tx`select id from people.identities where id=${identity.identity_id} for update`;
  const [application] = await tx`select id, identity_id, status, member_id, revision
    from applications.submissions where id=${applicationId} for update`;
  if (!application) throw new BackendError("NOT_FOUND", "Application was not found", 404);
  return application;
}

function conflict() {
  return new BackendError("CONFLICT", "Application changed since it was loaded", 409);
}

/** Filterable administrative review queue. Search is limited to applicant identity and preferred name. */
export async function listApplicationQueue(sql: postgres.Sql, actorId: string, rawFilters: unknown = {}) {
  const actor = uuid(actorId);
  const filters = queueInput.parse(rawFilters);
  const query = filters.query ? `%${filters.query.replace(/[\\%_]/g, "\\$&")}%` : null;
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    return tx`select a.id, a.identity_id, i.email, a.preferred_name, a.grade,
        a.grade_academic_year, a.status, a.submitted_at, a.status_updated_at, a.revision
      from applications.submissions a
      join people.identities i on i.id=a.identity_id
      where (${filters.status}='all' or a.status=${filters.status})
        and (${query}::text is null or a.preferred_name ilike ${query} escape '\\' or i.email ilike ${query} escape '\\')
      order by a.submitted_at, a.id limit ${filters.limit} offset ${filters.offset}`;
  });
}

/** Leadership review detail: full answers, internal review metadata, and restrictions as a separate field. */
export async function getAdminApplicationDetail(sql: postgres.Sql, actorId: string, applicationId: string) {
  const actor = uuid(actorId);
  const id = uuid(applicationId);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [application] = await tx`select a.id, a.identity_id, i.email, a.preferred_name,
        a.grade, a.grade_academic_year, a.academic_interests, a.join_reason, a.goals,
        a.experience, a.math_course, a.contest_interest, a.present_interest,
        a.attendance_confirmation, a.accuracy_acknowledged, a.status, a.status_reason,
        a.reviewed_by, a.member_id, a.submitted_at, a.status_updated_at, a.revision
      from applications.submissions a join people.identities i on i.id=a.identity_id
      where a.id=${id}`;
    if (!application) throw new BackendError("NOT_FOUND", "Application was not found", 404);
    const restrictions = await tx`select id, starts_at, ends_at, reason
      from applications.reapplication_restrictions where identity_id=${application.identity_id}
      order by starts_at desc`;
    return { application, restrictions };
  });
}

/** Full owner-visible answers; reviewer identity, internal reason and restriction reason stay private. */
export async function getOwnApplicationDetail(sql: postgres.Sql, actorId: string, applicationId: string) {
  const actor = uuid(actorId);
  const id = uuid(applicationId);
  return sql.begin(async (tx) => {
    const [application] = await tx`select id, preferred_name, grade, grade_academic_year,
        academic_interests, join_reason, goals, experience, math_course,
        contest_interest, present_interest, attendance_confirmation,
        accuracy_acknowledged, status, member_id, submitted_at, status_updated_at, revision
      from applications.submissions where id=${id} and identity_id=${actor}
        and exists (select 1 from people.identities where id=${actor} and enabled and school_verified)`;
    if (!application) throw new BackendError("NOT_FOUND", "Application was not found", 404);
    const [restriction] = await tx`select exists (
        select 1 from applications.reapplication_restrictions
        where identity_id=${actor} and starts_at <= now() and (ends_at is null or ends_at > now())
      ) as restricted`;
    return { application, reapplicationRestricted: restriction.restricted };
  });
}

/** Apply one supported review transition using a locked row and optimistic revision. */
export async function transitionApplication(
  sql: postgres.Sql,
  actorId: string,
  applicationId: string,
  expectedRevision: number,
  status: "under_review" | "rejected",
  reason: string | null = null,
) {
  const actor = uuid(actorId);
  const id = uuid(applicationId);
  const revision = revisionInput.parse(expectedRevision);
  const next = z.enum(["under_review", "rejected"]).parse(status);
  const statusReason = z.string().trim().max(256).nullable().parse(reason);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const application = await lockApplication(tx, id);
    if (application.revision !== revision) throw conflict();
    if (!(application.status === "submitted" || application.status === "under_review")) {
      throw new BackendError("INVALID_STATE", "This application is already closed", 409);
    }
    await tx`update applications.submissions set revision=revision+1 where id=${id} and revision=${revision}`;
    await tx`select applications.transition(${actor}, ${id}, ${next}, ${statusReason})`;
    const [updated] = await tx`select id, status, status_reason, status_updated_at, revision
      from applications.submissions where id=${id}`;
    return updated;
  });
}

/** Applicants may withdraw only their own open submission, using its loaded revision. */
export async function withdrawOwnApplication(
  sql: postgres.Sql,
  actorId: string,
  applicationId: string,
  expectedRevision: number,
) {
  const actor = uuid(actorId);
  const id = uuid(applicationId);
  const revision = revisionInput.parse(expectedRevision);
  return sql.begin(async (tx) => {
    const application = await lockApplication(tx, id);
    if (application.identity_id !== actor) {
      throw new BackendError("NOT_FOUND", "Application was not found", 404);
    }
    const [identity] = await tx`select enabled, school_verified from people.identities where id=${actor}`;
    if (!identity?.enabled || !identity.school_verified) {
      throw new BackendError("FORBIDDEN", "Verified identity access is required", 403);
    }
    if (application.revision !== revision) throw conflict();
    if (application.status !== "submitted" && application.status !== "under_review") {
      throw new BackendError("INVALID_STATE", "This application is already closed", 409);
    }
    await tx`update applications.submissions set revision=revision+1 where id=${id} and revision=${revision}`;
    await tx`select applications.transition(${actor}, ${id}, 'withdrawn', null)`;
    const [updated] = await tx`select id, status, status_updated_at, revision
      from applications.submissions where id=${id}`;
    return updated;
  });
}

/** Acceptance is retry-safe: an already accepted row returns its original member before revision comparison. */
export async function acceptApplicationReview(
  sql: postgres.Sql,
  actorId: string,
  applicationId: string,
  expectedRevision: number,
  rawMemberCard: unknown,
) {
  const actor = uuid(actorId);
  const id = uuid(applicationId);
  const revision = revisionInput.parse(expectedRevision);
  const card = memberCardInput.parse(rawMemberCard);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const application = await lockApplication(tx, id);
    if (application.status === "accepted") return application.member_id as string;
    if (application.revision !== revision) throw conflict();
    if (application.status !== "submitted" && application.status !== "under_review") {
      throw new BackendError("INVALID_STATE", "This application cannot be accepted", 409);
    }
    await tx`update applications.submissions set revision=revision+1 where id=${id} and revision=${revision}`;
    const [row] = await tx`select applications.accept(${actor}, ${id}, ${card.displayName},
      ${card.grade}, ${card.gradeAcademicYear}, ${card.startsOn}::date, ${card.privateNotes}) as member_id`;
    return row.member_id as string;
  });
}

export { reviewStatus };

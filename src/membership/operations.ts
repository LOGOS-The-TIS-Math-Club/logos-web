import type postgres from "postgres";
import { z } from "zod";
import { BackendError } from "../server/errors.ts";
import {
  attendanceSummary,
  type AttendanceStatus,
} from "../attendance/summary.ts";
import { academicYearAt, gradeAt } from "./grade.ts";

const uuid = (value: string) => z.uuid().parse(value);
type Tx = postgres.TransactionSql;
const revisionInput = z.number().int().positive();
const memberCardInput = z.object({
  displayName: z.string().trim().min(1).max(80),
  grade: z.number().int().min(9).max(12),
  gradeAcademicYear: z.number().int().min(1900).max(2200),
  privateNotes: z.string().trim().max(4000).default(""),
});
const stateInput = z
  .object({
    effectiveOn: z.iso.date(),
    status: z.enum(["active", "paused", "former"]),
    departureReason: z.enum(["graduated", "quit", "removed"]).optional(),
  })
  .superRefine((value, ctx) => {
    if ((value.status === "former") !== Boolean(value.departureReason)) {
      ctx.addIssue({
        code: "custom",
        path: ["departureReason"],
        message:
          "Former members need a departure reason; other states cannot have one.",
      });
    }
  });

type StateFilter = "active" | "paused" | "former" | "all";
type GradeRecord = { grade: number; grade_academic_year: number };

async function requireAdmin(tx: Tx, actor: string) {
  await tx`select people.require_admin(${actor})`;
}

async function recordHistory(
  tx: Tx,
  actor: string,
  action: string,
  entity: string,
  details: Record<string, string | number | boolean | null>,
) {
  await tx`insert into operations.change_history(actor_id, action, entity_id, details)
    values (${actor}, ${action}, ${entity}, ${tx.json(details)})`;
}

async function requireMemberOrConflict(tx: Tx, id: string) {
  const rows = await tx`select 1 from members.memberships where id=${id}`;
  if (!rows.length)
    throw new BackendError("NOT_FOUND", "Member was not found", 404);
  throw new BackendError("CONFLICT", "Member changed since it was loaded", 409);
}

function stateFilter(value: unknown): StateFilter {
  return z
    .enum(["active", "paused", "former", "all"])
    .default("active")
    .parse(value);
}

function withCurrentGrade<
  T extends { grade: number; grade_academic_year: number },
>(row: T) {
  const now = new Date();
  return {
    ...row,
    currentGrade: gradeAt(row.grade, row.grade_academic_year, now),
    currentGradeAcademicYear: academicYearAt(now),
  };
}

/** Leadership roster; the ordinary view defaults to currently active members. */
export async function listMembers(
  sql: postgres.Sql,
  actorId: string,
  rawFilter: unknown = "active",
) {
  const actor = uuid(actorId);
  const filter = stateFilter(rawFilter);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const rows = await tx<
      (GradeRecord & {
        id: string;
        identity_id: string;
        display_name: string;
        status: string;
        departure_reason: string | null;
        state_since: string;
        revision: number;
      })[]
    >`select id, identity_id, display_name, grade,
        grade_academic_year, status, departure_reason, state_since, revision
      from members.current_roster
      where (${filter}='all' or status=${filter})
      order by display_name, id`;
    return rows.map(withCurrentGrade);
  });
}

/** Leadership-only detail, including answers and separately named private material. */
export async function getAdminMemberDetail(
  sql: postgres.Sql,
  actorId: string,
  memberId: string,
) {
  const actor = uuid(actorId);
  const member = uuid(memberId);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [card] = await tx<
      (GradeRecord & {
        id: string;
        identity_id: string;
        display_name: string;
        created_at: string;
        updated_at: string;
        revision: number;
        email: string;
        enabled: boolean;
        school_verified: boolean;
        status: string | null;
        departure_reason: string | null;
        state_since: string | null;
      })[]
    >`select m.id, m.identity_id, m.display_name, m.grade,
        m.grade_academic_year, m.created_at, m.updated_at, m.revision,
        i.email, i.enabled, i.school_verified,
        r.status, r.departure_reason, r.state_since
      from members.memberships m
      join people.identities i on i.id=m.identity_id
      left join members.current_roster r on r.id=m.id
      where m.id=${member}`;
    if (!card) throw new BackendError("NOT_FOUND", "Member was not found", 404);
    const [privateNotes] =
      await tx`select notes from members.private_notes where member_id=${member}`;
    const applications =
      await tx`select id, preferred_name, grade, grade_academic_year,
        academic_interests, join_reason, goals, experience, math_course,
        contest_interest, present_interest, attendance_confirmation,
        accuracy_acknowledged, status, status_reason, reviewed_by, member_id,
        submitted_at, status_updated_at, revision
      from applications.submissions where identity_id=${card.identity_id}
      order by submitted_at desc`;
    const history = await tx`select action, details, recorded_at
      from operations.change_history where entity_id=${member}
      order by recorded_at desc limit 50`;
    const attendanceRecords = await tx<
      { status: AttendanceStatus }[]
    >`select status from meetings.eligible_attendance(${member}, now())`;
    return {
      member: withCurrentGrade(card),
      private: { notes: privateNotes?.notes ?? "" },
      applications,
      history,
      attendance: attendanceSummary(attendanceRecords),
    };
  });
}

/** A member can only retrieve their own card, answers and attendance summary. */
export async function getOwnMemberDetail(sql: postgres.Sql, actorId: string) {
  const actor = uuid(actorId);
  return sql.begin(async (tx) => {
    const [allowed] =
      await tx`select people.has_access(${actor}, 'member') as allowed`;
    if (!allowed?.allowed)
      throw new BackendError("FORBIDDEN", "Member access is required", 403);
    const [member] = await tx<
      (GradeRecord & {
        id: string;
        display_name: string;
        created_at: string;
        updated_at: string;
        revision: number;
        status: string | null;
        state_since: string | null;
      })[]
    >`select m.id, m.display_name, m.grade,
        m.grade_academic_year, m.created_at, m.updated_at, m.revision,
        r.status, r.state_since
      from members.memberships m
      left join members.current_roster r on r.id=m.id
      where m.identity_id=${actor}`;
    if (!member)
      throw new BackendError("NOT_FOUND", "Member record was not found", 404);
    const applications =
      await tx`select id, preferred_name, grade, grade_academic_year,
        academic_interests, join_reason, goals, experience, math_course,
        contest_interest, present_interest, attendance_confirmation,
        accuracy_acknowledged, status, submitted_at, status_updated_at, revision
      from applications.submissions where identity_id=${actor}
      order by submitted_at desc`;
    const attendanceRecords = await tx<
      { status: AttendanceStatus }[]
    >`select status from meetings.eligible_attendance(${member.id}, now())`;
    return {
      member: withCurrentGrade(member),
      applications,
      attendance: attendanceSummary(attendanceRecords),
    };
  });
}

export async function updateMemberCard(
  sql: postgres.Sql,
  actorId: string,
  memberId: string,
  expectedRevision: number,
  raw: unknown,
) {
  const actor = uuid(actorId);
  const member = uuid(memberId);
  const revision = revisionInput.parse(expectedRevision);
  const input = memberCardInput.parse(raw);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [updated] =
      await tx`update members.memberships set display_name=${input.displayName},
        grade=${input.grade}, grade_academic_year=${input.gradeAcademicYear}, revision=revision+1
      where id=${member} and revision=${revision} returning id, display_name, grade, grade_academic_year, updated_at, revision`;
    if (!updated) await requireMemberOrConflict(tx, member);
    await tx`insert into members.private_notes(member_id, notes) values (${member}, ${input.privateNotes})
      on conflict(member_id) do update set notes=excluded.notes`;
    await recordHistory(tx, actor, "membership.card_updated", member, {
      revision: updated.revision,
    });
    return updated;
  });
}

export async function changeMembershipState(
  sql: postgres.Sql,
  actorId: string,
  memberId: string,
  expectedRevision: number,
  raw: unknown,
) {
  const actor = uuid(actorId);
  const member = uuid(memberId);
  const revision = revisionInput.parse(expectedRevision);
  const input = stateInput.parse(raw);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [updated] =
      await tx`update members.memberships set revision=revision+1
      where id=${member} and revision=${revision} returning revision`;
    if (!updated) await requireMemberOrConflict(tx, member);
    await tx`select members.change_state(${actor}, ${member}, ${input.effectiveOn}::date,
      ${input.status}, ${input.departureReason ?? null})`;
    return { memberId: member, revision: updated.revision };
  });
}

export async function grantAdmin(
  sql: postgres.Sql,
  actorId: string,
  identityId: string,
) {
  const actor = uuid(actorId);
  const target = uuid(identityId);
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('people.admin_role_change'))`;
    await requireAdmin(tx, actor);
    const [identity] =
      await tx`select enabled, school_verified from people.identities where id=${target} for update`;
    if (!identity)
      throw new BackendError("NOT_FOUND", "Identity was not found", 404);
    if (!identity.enabled || !identity.school_verified)
      throw new BackendError(
        "INVALID_STATE",
        "Only enabled, school-verified identities can hold admin access",
        422,
      );
    const [row] =
      await tx`insert into people.role_grants(identity_id, role, granted_by)
      values (${target}, 'admin', ${actor}) on conflict(identity_id,role) do nothing returning identity_id`;
    if (row) await recordHistory(tx, actor, "access.admin_granted", target, {});
    return { identityId: target, granted: Boolean(row) };
  });
}

export async function revokeAdmin(
  sql: postgres.Sql,
  actorId: string,
  identityId: string,
) {
  const actor = uuid(actorId);
  const target = uuid(identityId);
  return sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext('people.admin_role_change'))`;
    await requireAdmin(tx, actor);
    const [identity] =
      await tx`select id from people.identities where id=${target} for update`;
    if (!identity)
      throw new BackendError("NOT_FOUND", "Identity was not found", 404);
    const [grant] =
      await tx`select 1 from people.role_grants where identity_id=${target} and role='admin' for update`;
    if (!grant) return { identityId: target, revoked: false };
    const [count] =
      await tx`select count(*)::int as count from people.role_grants r
      join people.identities i on i.id=r.identity_id
      where r.role='admin' and i.enabled and i.school_verified`;
    if (count.count <= 1)
      throw new BackendError(
        "INVALID_STATE",
        "The final enabled administrator cannot be removed",
        409,
      );
    await tx`delete from people.role_grants where identity_id=${target} and role='admin'`;
    await recordHistory(tx, actor, "access.admin_revoked", target, {});
    return { identityId: target, revoked: true };
  });
}

const restrictionInput = z.object({
  reason: z.string().trim().min(1).max(500),
  startsAt: z.iso.datetime().optional(),
  endsAt: z.iso.datetime().nullable().optional(),
});

export async function createReapplicationRestriction(
  sql: postgres.Sql,
  actorId: string,
  identityId: string,
  raw: unknown,
) {
  const actor = uuid(actorId);
  const identity = uuid(identityId);
  const input = restrictionInput.parse(raw);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] =
      await tx`insert into applications.reapplication_restrictions(identity_id, starts_at, ends_at, reason, recorded_by)
      values (${identity}, coalesce(${input.startsAt ?? null}::timestamptz, now()), ${input.endsAt ?? null}::timestamptz, ${input.reason}, ${actor})
      returning id, identity_id, starts_at, ends_at, reason`;
    await recordHistory(tx, actor, "application.restriction_created", row.id, {
      identityId: identity,
    });
    return row;
  });
}

export async function endReapplicationRestriction(
  sql: postgres.Sql,
  actorId: string,
  restrictionId: string,
  endedAt?: string,
) {
  const actor = uuid(actorId);
  const restriction = uuid(restrictionId);
  const end = endedAt === undefined ? null : z.iso.datetime().parse(endedAt);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] =
      await tx`update applications.reapplication_restrictions set ends_at=coalesce(${end}::timestamptz, now())
      where id=${restriction} and ends_at is null and starts_at < coalesce(${end}::timestamptz, now())
      returning id, identity_id, ends_at`;
    if (!row) {
      const [existing] =
        await tx`select 1 from applications.reapplication_restrictions where id=${restriction}`;
      if (!existing)
        throw new BackendError("NOT_FOUND", "Restriction was not found", 404);
      throw new BackendError(
        "CONFLICT",
        "Restriction has already ended or the end date is invalid",
        409,
      );
    }
    await recordHistory(tx, actor, "application.restriction_ended", row.id, {
      identityId: row.identity_id,
    });
    return row;
  });
}

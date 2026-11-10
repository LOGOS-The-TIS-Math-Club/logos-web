import type postgres from "postgres";
import { z } from "zod";
import { BackendError } from "../server/errors.ts";
import { attendanceSummary, type AttendanceStatus } from "./summary.ts";

const idInput = z.uuid();
const revisionInput = z.number().int().positive();
const attendanceStatus = z.enum([
  "present",
  "late",
  "excused_absence",
  "unexcused_absence",
  "unmarked",
]);
const attendanceBatchInput = z
  .array(
    z.object({
      memberId: z.uuid(),
      status: attendanceStatus,
      notes: z
        .string()
        .trim()
        .max(256)
        .nullish()
        .transform((v) => v || null),
    }),
  )
  .min(1)
  .max(500)
  .refine(
    (rows) => new Set(rows.map((r) => r.memberId)).size === rows.length,
    "A member may appear only once in an attendance batch",
  );

const noticeInput = z
  .object({
    requestId: z.uuid().transform(value => value.toLowerCase()).optional(),
    sessionId: z.uuid().transform(value => value.toLowerCase()).optional(),
    sessionDate: z.iso.date().optional(),
    reason: z.string().trim().min(1).max(500),
  })
  .refine(
    (v) => Boolean(v.sessionId) !== Boolean(v.sessionDate),
    "Provide either a session or a standalone date",
  );

async function requireAdmin(tx: postgres.TransactionSql, actor: string) {
  await tx`select people.require_admin(${actor})`;
}

async function requireMember(tx: postgres.TransactionSql, actor: string) {
  const [access] =
    await tx`select people.has_access(${actor},'member') as allowed`;
  if (!access?.allowed)
    throw new BackendError("FORBIDDEN", "Member access required", 403);
  const [member] =
    await tx`select id from members.memberships where identity_id=${actor}`;
  if (!member)
    throw new BackendError("FORBIDDEN", "Member access required", 403);
  return member.id as string;
}

function assertRevision(actual: number, expected: number, entity: string) {
  if (actual !== expected)
    throw new BackendError(
      "CONFLICT",
      `${entity} changed; reload before saving`,
      409,
    );
}

export async function getSessionAttendance(
  sql: postgres.Sql,
  actorId: string,
  sessionId: string,
) {
  const actor = idInput.parse(actorId);
  const session = idInput.parse(sessionId);
  return sql.begin("isolation level repeatable read", async (tx) => {
    await requireAdmin(tx, actor);
    const [s] =
      await tx`select id,revision,status,starts_at_local::date as session_date
      from meetings.sessions where id=${session}`;
    if (!s) throw new BackendError("NOT_FOUND", "Session not found", 404);
    const rows = await tx`
      with eligible as (
        select m.id,m.display_name from members.memberships m
        join members.state_periods p on p.member_id=m.id and p.status='active'
          and p.starts_on <= ${s.session_date}::date and (p.ends_on is null or p.ends_on > ${s.session_date}::date)
      ), ids as (
        select id as member_id from eligible
        union
        select member_id from meetings.attendance where session_id=${session}
        union
        select member_id from meetings.absence_notices where status <> 'cancelled'
          and (session_id=${session} or (session_id is null and session_date=${s.session_date}::date))
      )
      select ids.member_id as "memberId", coalesce(e.display_name,m.display_name) as "displayName",
        (e.id is not null) as eligible, coalesce(a.status,'unmarked') as status,
        a.notes, a.revision as "attendanceRevision",
        coalesce((select json_agg(json_build_object('id',n.id,'reason',n.reason,'status',n.status,
          'revision',n.revision,'createdAt',n.created_at) order by n.created_at)
          from meetings.absence_notices n where n.member_id=ids.member_id and n.status <> 'cancelled'
            and (n.session_id=${session} or (n.session_id is null and n.session_date=${s.session_date}::date))), '[]'::json) as notices
      from ids join members.memberships m on m.id=ids.member_id
      left join eligible e on e.id=ids.member_id
      left join meetings.attendance a on a.member_id=ids.member_id and a.session_id=${session}
      order by coalesce(e.display_name,m.display_name),ids.member_id`;
    return {
      sessionId: s.id as string,
      sessionRevision: s.revision as number,
      sessionStatus: s.status as string,
      roster: rows,
    };
  });
}

export async function saveSessionAttendance(
  sql: postgres.Sql,
  actorId: string,
  sessionId: string,
  expectedSessionRevision: number,
  raw: unknown,
) {
  const actor = idInput.parse(actorId);
  const session = idInput.parse(sessionId);
  const expected = revisionInput.parse(expectedSessionRevision);
  const rows = attendanceBatchInput.parse(raw);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [s] =
      await tx`select revision,status,starts_at_local::date as session_date
      from meetings.sessions where id=${session} for update`;
    if (!s) throw new BackendError("NOT_FOUND", "Session not found", 404);
    assertRevision(s.revision, expected, "Session");

    let changed = 0;
    for (const row of rows) {
      const [existing] = await tx`select revision from meetings.attendance
        where session_id=${session} and member_id=${row.memberId}`;
      if (!existing) {
        if (s.status !== "scheduled")
          throw new BackendError(
            "INVALID_STATE",
            "Cannot add attendance to a cancelled session",
            409,
          );
        const [eligible] = await tx`select exists (
          select 1 from members.memberships m join members.state_periods p on p.member_id=m.id
          where m.id=${row.memberId} and p.status='active'
            and p.starts_on <= ${s.session_date}::date
            and (p.ends_on is null or p.ends_on > ${s.session_date}::date)
        ) as allowed`;
        if (!eligible.allowed)
          throw new BackendError(
            "INVALID_STATE",
            "Member is not eligible for this session date",
            409,
          );
      }
      await tx`select meetings.record_attendance(${actor},${row.memberId},${session},${row.status},${row.notes})`;
      if (existing)
        await tx`update meetings.attendance set revision=revision+1
          where session_id=${session} and member_id=${row.memberId}`;
      changed++;
    }
    const [updated] = await tx`update meetings.sessions set revision=revision+1
      where id=${session} returning revision`;
    return {
      sessionId: session,
      revision: updated.revision as number,
      changed,
    };
  });
}

export async function getOwnAttendanceSummary(
  sql: postgres.Sql,
  actorId: string,
  asOf: string | Date = new Date(),
) {
  const actor = idInput.parse(actorId);
  const instant =
    typeof asOf === "string" ? z.iso.datetime().parse(asOf) : asOf;
  return sql.begin(async (tx) => {
    const member = await requireMember(tx, actor);
    const records = await tx<
      { session_id: string; status: AttendanceStatus }[]
    >`
      select * from meetings.eligible_attendance(${member},${instant})`;
    return {
      records: records.map((r) => ({
        sessionId: r.session_id,
        status: r.status,
      })),
      summary: attendanceSummary(records),
    };
  });
}

export async function createAbsenceNotice(
  sql: postgres.Sql,
  actorId: string,
  raw: unknown,
) {
  const actor = idInput.parse(actorId);
  const v = noticeInput.parse(raw);
  return sql.begin(async (tx) => {
    const member = await requireMember(tx, actor);
    if (v.requestId) {
      await tx`select id from members.memberships where id=${member} for update`;
      await requireMember(tx, actor);
      const [existing] = await tx`select id,member_id,session_id,session_date::text as date,reason,status,revision
        from meetings.absence_notices where id=${v.requestId}`;
      if (existing) {
        if (existing.member_id !== member || existing.reason !== v.reason ||
          existing.session_id !== (v.sessionId ?? null) || existing.date !== (v.sessionDate ?? null))
          throw new BackendError("CONFLICT", "This notice ID was already used. Check your notices before starting a new notice.", 409);
        return { id: existing.id as string, revision: existing.revision as number, status: existing.status as string };
      }
    }
    const [row] = v.sessionId
      ? await tx`insert into meetings.absence_notices(id,member_id,session_id,reason,submitted_by)
          values (coalesce(${v.requestId ?? null}::uuid,gen_random_uuid()),${member},${v.sessionId},${v.reason},${actor}) returning id,revision,status`
      : await tx`insert into meetings.absence_notices(id,member_id,session_date,reason,submitted_by)
          values (coalesce(${v.requestId ?? null}::uuid,gen_random_uuid()),${member},${v.sessionDate!}::text::date,${v.reason},${actor}) returning id,revision,status`;
    return {
      id: row.id as string,
      revision: row.revision as number,
      status: row.status as string,
    };
  });
}

export async function getOwnAbsenceNotices(sql: postgres.Sql, actorId: string) {
  const actor = idInput.parse(actorId);
  return sql.begin(async (tx) => {
    const member = await requireMember(tx, actor);
    return tx`select n.id,n.session_id as "sessionId",n.session_date as "sessionDate",
      n.reason,n.status,n.revision,n.created_at as "createdAt",n.updated_at as "updatedAt"
      from meetings.absence_notices n where n.member_id=${member}
      order by n.created_at desc,n.id`;
  });
}

export async function cancelAbsenceNotice(
  sql: postgres.Sql,
  actorId: string,
  noticeId: string,
  expectedRevision: number,
) {
  const actor = idInput.parse(actorId);
  const id = idInput.parse(noticeId);
  const expected = revisionInput.parse(expectedRevision);
  return sql.begin(async (tx) => {
    const member = await requireMember(tx, actor);
    const [notice] =
      await tx`select member_id,revision,status from meetings.absence_notices where id=${id} for update`;
    if (!notice || notice.member_id !== member)
      throw new BackendError("NOT_FOUND", "Absence notice not found", 404);
    assertRevision(notice.revision, expected, "Absence notice");
    if (notice.status === "cancelled")
      throw new BackendError(
        "INVALID_STATE",
        "Absence notice is already cancelled",
        409,
      );
    const [row] =
      await tx`update meetings.absence_notices set status='cancelled',revision=revision+1
      where id=${id} returning revision,status`;
    return {
      id,
      revision: row.revision as number,
      status: row.status as string,
    };
  });
}

export async function acknowledgeAbsenceNotice(
  sql: postgres.Sql,
  actorId: string,
  noticeId: string,
  expectedRevision: number,
) {
  const actor = idInput.parse(actorId);
  const id = idInput.parse(noticeId);
  const expected = revisionInput.parse(expectedRevision);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [notice] =
      await tx`select revision,status from meetings.absence_notices where id=${id} for update`;
    if (!notice)
      throw new BackendError("NOT_FOUND", "Absence notice not found", 404);
    assertRevision(notice.revision, expected, "Absence notice");
    if (notice.status !== "submitted")
      throw new BackendError(
        "INVALID_STATE",
        "Only submitted notices can be acknowledged",
        409,
      );
    const [row] =
      await tx`update meetings.absence_notices set status='acknowledged',revision=revision+1
      where id=${id} returning revision,status`;
    await tx`insert into operations.change_history(actor_id,action,entity_id,details)
      values (${actor},'absence_notice.acknowledged',${id},jsonb_build_object('revision',${row.revision}::int))`;
    return {
      id,
      revision: row.revision as number,
      status: row.status as string,
    };
  });
}

export async function getAdminAbsenceNotices(
  sql: postgres.Sql,
  actorId: string,
) {
  const actor = idInput.parse(actorId);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    return tx`select n.id,n.member_id,m.display_name,n.session_id,
      coalesce(s.starts_at_local::date,n.session_date) as session_date,
      n.reason,n.status,n.created_at,n.revision
      from meetings.absence_notices n join members.memberships m on m.id=n.member_id
      left join meetings.sessions s on s.id=n.session_id
      order by n.created_at desc,n.id`;
  });
}

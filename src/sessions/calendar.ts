import type postgres from "postgres";
import { z } from "zod";
import { BackendError } from "../server/errors.ts";
import { sessionInput } from "./input.ts";

export const termInput = z
  .object({
    id: z.uuid(),
    academicYearId: z.uuid(),
    name: z.string().trim().min(1).max(80),
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
  })
  .refine((v) => v.startsOn < v.endsOn, "Term end must follow its start");

export async function configureTerm(
  sql: postgres.Sql,
  actorId: string,
  raw: unknown,
): Promise<string> {
  const actor = z.uuid().parse(actorId);
  const v = termInput.parse(raw);
  const [row] =
    await sql`select meetings.set_term(${actor},${v.id},${v.academicYearId},${v.name},${v.startsOn}::text::date,${v.endsOn}::text::date) as id`;
  return row.id;
}
export async function assignSessionTerm(
  sql: postgres.Sql,
  actorId: string,
  sessionId: string,
  termId: string,
  expectedRevision?: number,
) {
  const actor = z.uuid().parse(actorId);
  const session = z.uuid().parse(sessionId);
  const term = z.uuid().parse(termId);
  const expected = expectedRevision === undefined ? undefined : revisionInput.parse(expectedRevision);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [current] = await tx`select revision from meetings.sessions where id=${session} for update`;
    if (!current) throw new BackendError("NOT_FOUND", "Session not found", 404);
    if (expected !== undefined && current.revision !== expected)
      throw new BackendError("CONFLICT", "Session changed; reload before saving", 409);
    const [row] = await tx`update meetings.sessions s set term_id=${term},
      academic_year_id=t.academic_year_id,revision=s.revision+1
      from meetings.terms t where s.id=${session} and t.id=${term} returning s.id,s.revision`;
    if (!row) throw new BackendError("NOT_FOUND", "Term not found", 404);
    await tx`insert into operations.change_history(actor_id,action,entity_id,details)
      values (${actor},'session.term_assigned',${session},jsonb_build_object('termId',${term}::text,'revision',${row.revision}::int))`;
    return { id: row.id as string, revision: row.revision as number };
  });
}

const sessionIdInput = z.uuid();
const revisionInput = z.number().int().positive();
const sessionCreateInput = sessionInput.extend({ id: z.uuid() });
const sessionUpdateInput = sessionInput.omit({ status: true });
const academicYearInput = z.object({
  id: z.uuid(),
  name: z.string().trim().min(1).max(80),
  startYear: z.number().int().min(1900).max(2200),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
}).refine((v) => v.startsOn < v.endsOn, "Academic year end must follow its start");
const termFormInput = z.object({
  id: z.uuid(),
  academicYearId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  startsOn: z.iso.date(),
  endsOn: z.iso.date(),
}).refine((v) => v.startsOn < v.endsOn, "Term end must follow its start");

export async function createAcademicYear(
  sql: postgres.Sql,
  actorId: string,
  raw: unknown,
) {
  const actor = z.uuid().parse(actorId);
  const v = academicYearInput.parse(raw);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] = await tx`insert into meetings.academic_years(id,name,start_year,starts_on,ends_on)
      values (${v.id},${v.name},${v.startYear},${v.startsOn}::text::date,${v.endsOn}::text::date)
      returning id,revision`;
    await tx`insert into operations.change_history(actor_id,action,entity_id,details)
      values (${actor},'academic_year.created',${row.id},jsonb_build_object('revision',${row.revision}::int))`;
    return { id: row.id as string, revision: row.revision as number };
  });
}

export async function updateAcademicYear(
  sql: postgres.Sql,
  actorId: string,
  expectedRevision: number,
  raw: unknown,
) {
  const actor = z.uuid().parse(actorId);
  const expected = revisionInput.parse(expectedRevision);
  const v = academicYearInput.parse(raw);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [current] = await tx`select revision from meetings.academic_years where id=${v.id} for update`;
    if (!current) throw new BackendError("NOT_FOUND", "Academic year not found", 404);
    if (current.revision !== expected) throw new BackendError("CONFLICT", "Academic year changed; reload before saving", 409);
    const [row] = await tx`update meetings.academic_years set name=${v.name},start_year=${v.startYear},
      starts_on=${v.startsOn}::text::date,ends_on=${v.endsOn}::text::date,revision=revision+1
      where id=${v.id} returning id,revision`;
    await tx`insert into operations.change_history(actor_id,action,entity_id,details)
      values (${actor},'academic_year.updated',${row.id},jsonb_build_object('revision',${row.revision}::int))`;
    return { id: row.id as string, revision: row.revision as number };
  });
}

export async function createTerm(
  sql: postgres.Sql,
  actorId: string,
  raw: unknown,
) {
  const actor = z.uuid().parse(actorId);
  const v = termFormInput.parse(raw);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] = await tx`insert into meetings.terms(id,academic_year_id,name,starts_on,ends_on)
      values (${v.id},${v.academicYearId},${v.name},${v.startsOn}::text::date,${v.endsOn}::text::date)
      returning id,revision`;
    await tx`insert into operations.change_history(actor_id,action,entity_id,details)
      values (${actor},'term.created',${row.id},jsonb_build_object('academicYearId',${v.academicYearId}::text,'revision',${row.revision}::int))`;
    return { id: row.id as string, revision: row.revision as number };
  });
}

export async function updateTerm(
  sql: postgres.Sql,
  actorId: string,
  expectedRevision: number,
  raw: unknown,
) {
  const actor = z.uuid().parse(actorId);
  const expected = revisionInput.parse(expectedRevision);
  const v = termFormInput.parse(raw);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [current] = await tx`select revision from meetings.terms where id=${v.id} for update`;
    if (!current) throw new BackendError("NOT_FOUND", "Term not found", 404);
    if (current.revision !== expected) throw new BackendError("CONFLICT", "Term changed; reload before saving", 409);
    const [row] = await tx`update meetings.terms set academic_year_id=${v.academicYearId},name=${v.name},
      starts_on=${v.startsOn}::text::date,ends_on=${v.endsOn}::text::date,revision=revision+1
      where id=${v.id} returning id,revision`;
    await tx`insert into operations.change_history(actor_id,action,entity_id,details)
      values (${actor},'term.updated',${row.id},jsonb_build_object('academicYearId',${v.academicYearId}::text,'revision',${row.revision}::int))`;
    return { id: row.id as string, revision: row.revision as number };
  });
}

function sessionValues(v: z.infer<typeof sessionInput>) {
  return {
    termId: v.termId,
    startsAtLocal: `${v.date} ${v.startTime}:00`,
    durationMinutes: v.durationMinutes,
    title: v.title,
    description: v.description,
    materialsFolderUrl: v.materialsFolderUrl ?? null,
    status: v.status,
  };
}

async function requireAdmin(tx: postgres.TransactionSql, actor: string) {
  await tx`select people.require_admin(${actor})`;
}

async function requireCalendarReader(tx: postgres.TransactionSql, actor: string) {
  const [row] = await tx`select people.has_access(${actor},'member') as allowed`;
  if (!row?.allowed)
    throw new BackendError("FORBIDDEN", "Member access is required", 403);
}

async function assertSessionRevision(
  tx: postgres.TransactionSql,
  sessionId: string,
  revision: number,
) {
  const [row] = await tx`
    select revision from meetings.sessions where id=${sessionId} for update`;
  if (!row) throw new BackendError("NOT_FOUND", "Session not found", 404);
  if (row.revision !== revision)
    throw new BackendError("CONFLICT", "Session changed; reload before saving", 409);
}

export async function createSession(
  sql: postgres.Sql,
  actorId: string,
  raw: unknown,
) {
  const actor = z.uuid().parse(actorId);
  const v = sessionCreateInput.parse(raw);
  const values = sessionValues(v);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    const [row] = await tx`
      insert into meetings.sessions(id,term_id,starts_at_local,duration_minutes,title,description,materials_folder_url,status,created_by)
      values (${v.id},${values.termId},${values.startsAtLocal}::text::timestamp,${values.durationMinutes},${values.title},${values.description},${values.materialsFolderUrl},${values.status},${actor})
      returning id, revision`;
    await tx`insert into operations.change_history(actor_id,action,entity_id,details)
      values (${actor},'session.created',${row.id},jsonb_build_object('termId',${values.termId}::text,'revision',${row.revision}::int))`;
    return { id: row.id as string, revision: row.revision as number };
  });
}

export async function updateSession(
  sql: postgres.Sql,
  actorId: string,
  sessionId: string,
  expectedRevision: number,
  raw: unknown,
) {
  const actor = z.uuid().parse(actorId);
  const id = sessionIdInput.parse(sessionId);
  const revision = revisionInput.parse(expectedRevision);
  const v = sessionUpdateInput.parse(raw);
  const values = sessionValues({ ...v, status: "scheduled" });
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    await assertSessionRevision(tx, id, revision);
    const [term] = await tx`select academic_year_id from meetings.terms where id=${values.termId}`;
    if (!term) throw new BackendError("NOT_FOUND", "Term not found", 404);
    const [row] = await tx`
      update meetings.sessions set term_id=${values.termId}, academic_year_id=${term.academic_year_id}, starts_at_local=${values.startsAtLocal}::text::timestamp,
        duration_minutes=${values.durationMinutes}, title=${values.title}, description=${values.description},
        materials_folder_url=${values.materialsFolderUrl}, revision=revision+1
      where id=${id} returning id,revision`;
    await tx`insert into operations.change_history(actor_id,action,entity_id,details)
      values (${actor},'session.updated',${id},jsonb_build_object('revision',${row.revision}::int))`;
    return { id: row.id as string, revision: row.revision as number };
  });
}

export async function cancelSession(
  sql: postgres.Sql,
  actorId: string,
  sessionId: string,
  expectedRevision: number,
) {
  const actor = z.uuid().parse(actorId);
  const id = sessionIdInput.parse(sessionId);
  const revision = revisionInput.parse(expectedRevision);
  return sql.begin(async (tx) => {
    await requireAdmin(tx, actor);
    await assertSessionRevision(tx, id, revision);
    const [row] = await tx`update meetings.sessions set status='cancelled',revision=revision+1
      where id=${id} returning id,revision`;
    await tx`insert into operations.change_history(actor_id,action,entity_id,details)
      values (${actor},'session.cancelled',${id},jsonb_build_object('revision',${row.revision}::int))`;
    return { id: row.id as string, revision: row.revision as number };
  });
}

export async function getSessionsByAcademicYear(
  sql: postgres.Sql,
  actorId: string,
  academicYearId: string,
) {
  const actor = z.uuid().parse(actorId);
  const year = z.uuid().parse(academicYearId);
  return sql.begin(async (tx) => {
    await requireCalendarReader(tx, actor);
    return tx`select st.*,s.academic_year_id from meetings.session_times st
      join meetings.sessions s using (id) where s.academic_year_id=${year} order by st.starts_at_local,st.id`;
  });
}

export async function getSessionsByTerm(
  sql: postgres.Sql,
  actorId: string,
  termId: string,
) {
  const actor = z.uuid().parse(actorId);
  const term = z.uuid().parse(termId);
  return sql.begin(async (tx) => {
    await requireCalendarReader(tx, actor);
    return tx`select * from meetings.session_times where term_id=${term} order by starts_at_local,id`;
  });
}

export async function getUpcomingSessions(
  sql: postgres.Sql,
  actorId: string,
  limit = 20,
) {
  const actor = z.uuid().parse(actorId);
  const count = z.number().int().min(1).max(100).parse(limit);
  return sql.begin(async (tx) => {
    await requireCalendarReader(tx, actor);
    return tx`select * from meetings.session_times where status='scheduled' and starts_at > now()
      order by starts_at,id limit ${count}`;
  });
}

export async function getSessionDetail(
  sql: postgres.Sql,
  actorId: string,
  sessionId: string,
) {
  const actor = z.uuid().parse(actorId);
  const id = sessionIdInput.parse(sessionId);
  return sql.begin(async (tx) => {
    await requireCalendarReader(tx, actor);
    const [row] = await tx`select * from meetings.session_times where id=${id}`;
    if (!row) throw new BackendError("NOT_FOUND", "Session not found", 404);
    return row;
  });
}

export async function getCurrentCalendar(sql: postgres.Sql, actorId: string) {
  const actor = z.uuid().parse(actorId);
  return sql.begin(async (tx) => {
    await requireCalendarReader(tx, actor);
    const [year] = await tx`select * from meetings.academic_years
      where starts_on <= (now() at time zone 'Asia/Tokyo')::date
        and ends_on > (now() at time zone 'Asia/Tokyo')::date limit 1`;
    if (!year) return null;
    const [term] = await tx`select * from meetings.terms where academic_year_id=${year.id}
      and starts_on <= (now() at time zone 'Asia/Tokyo')::date
      and ends_on > (now() at time zone 'Asia/Tokyo')::date limit 1`;
    return {
      academicYear: year,
      term: term ?? null,
      sessions: await tx`select st.*,s.academic_year_id from meetings.session_times st
        join meetings.sessions s using (id) where s.academic_year_id=${year.id}
        order by st.starts_at_local,st.id`,
    };
  });
}

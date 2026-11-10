import type postgres from "postgres";
import { z } from "zod";
import { BackendError } from "../server/errors.ts";
export const recurringInput = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(1).max(1440),
  room: z.string().trim().max(120).default(""),
  published: z.boolean().default(false),
});
export async function getRecurringSettings(sql: postgres.Sql, actorId: string) {
  const actor = z.uuid().parse(actorId);
  return sql.begin(async (tx) => {
    await tx`select people.require_admin(${actor})`;
    const [row] =
      await tx`select weekday,start_time::text as start_time,duration_minutes,room,published,revision,updated_at from meetings.recurring_settings where id`;
    return row ?? null;
  });
}
export async function saveRecurringSettings(
  sql: postgres.Sql,
  actorId: string,
  raw: unknown,
) {
  const actor = z.uuid().parse(actorId);
  const input = recurringInput.parse(raw);
  const { revision } = z
    .object({ revision: z.number().int().nonnegative() })
    .parse(raw);
  return sql.begin(async (tx) => {
    await tx`select people.require_admin(${actor})`;
    await tx`select pg_advisory_xact_lock(hashtext('meetings.recurring_settings'))`;
    const [current] =
      await tx`select revision from meetings.recurring_settings where id for update`;
    if ((current?.revision ?? 0) !== revision)
      throw new BackendError(
        "CONFLICT",
        "Recurring settings changed. Reload and review before saving.",
        409,
      );
    const [row] =
      await tx`insert into meetings.recurring_settings(id,weekday,start_time,duration_minutes,room,published) values(true,${input.weekday},${input.startTime}::time,${input.durationMinutes},${input.room},${input.published}) on conflict(id) do update set weekday=excluded.weekday,start_time=excluded.start_time,duration_minutes=excluded.duration_minutes,room=excluded.room,published=excluded.published,revision=meetings.recurring_settings.revision+1,updated_at=now() returning revision`;
    await tx`insert into operations.change_history(actor_id,action,entity_id,details) values(${actor},'meeting.recurring_updated','00000000-0000-4000-8000-000000000009',${tx.json({ revision: row.revision, published: input.published })})`;
    return row;
  });
}
export async function getPublicRecurring(sql: postgres.Sql) {
  const [row] =
    await sql`select weekday,start_time::text as "startTime",duration_minutes as "durationMinutes",room from meetings.recurring_settings where id and published`;
  return row
    ? {
        weekday: Number(row.weekday),
        startTime: String(row.startTime).slice(0, 5),
        durationMinutes: Number(row.durationMinutes),
        room: String(row.room),
      }
    : null;
}
export const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

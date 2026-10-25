import type postgres from "postgres";
import { z } from "zod";

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
) {
  await sql`select meetings.assign_term(${z.uuid().parse(actorId)},${z.uuid().parse(sessionId)},${z.uuid().parse(termId)})`;
}

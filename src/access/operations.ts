import type postgres from "postgres";
import { z } from "zod";

export async function hasAccess(
  sql: postgres.Sql,
  actorId: string,
  role: "admin" | "member",
): Promise<boolean> {
  const [row] =
    await sql`select people.has_access(${z.uuid().parse(actorId)}, ${role}) as allowed`;
  return row.allowed;
}

export async function getOwnApplications(sql: postgres.Sql, actorId: string) {
  const actor = z.uuid().parse(actorId);
  return sql`select a.id, a.preferred_name, a.grade, a.grade_academic_year, a.status, a.submitted_at
    from applications.submissions a join people.identities i on i.id = a.identity_id
    where i.id = ${actor} and i.enabled and i.school_verified order by a.submitted_at desc`;
}

export async function getAdminMemberNotes(
  sql: postgres.Sql,
  actorId: string,
  memberId: string,
): Promise<string | null> {
  const actor = z.uuid().parse(actorId);
  const member = z.uuid().parse(memberId);
  return sql.begin(async (tx) => {
    await tx`select people.require_admin(${actor})`;
    const [row] =
      await tx`select notes from members.private_notes where member_id = ${member}`;
    return row?.notes ?? null;
  });
}

import "server-only";

import { SESSIONS, type SessionEntry } from "@/content/club";
import { listPublicSessions } from "@/lib/attendance/service.server";

/*
 * The programme shown on the public pages.
 *
 * Sessions live in logos.club_sessions so leadership can edit the date and the
 * topic from /admin/sessions without a deploy. The committed 2026 curriculum in
 * content/club.ts is the fallback, used only while the table is still empty —
 * on a database with no sessions yet the site keeps showing the real programme
 * instead of an empty page. As soon as one session exists, the database is the
 * only source and the constant is no longer consulted.
 *
 * A read failure falls back the same way rather than taking down the home page.
 */
export async function getProgramme(): Promise<readonly SessionEntry[]> {
  try {
    const rows = await listPublicSessions();
    if (rows.length === 0) return SESSIONS;

    return rows.map((row) => ({
      date: row.sessionDate,
      topic: row.title,
      note: row.notes ?? undefined,
    }));
  } catch {
    return SESSIONS;
  }
}

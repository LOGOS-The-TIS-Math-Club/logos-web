import { materialsFolderUrl } from "../sessions/input.ts";
import type { Session, SessionSummary } from "./types.ts";
export function sessionSummary(row: Record<string, any>): SessionSummary {
  return {
    id: row.id,
    title: row.title,
    startsAt: new Date(row.starts_at).toISOString(),
    endsAt: new Date(row.ends_at).toISOString(),
    durationMinutes: row.duration_minutes,
    status: row.status,
  };
}
export function sessionInfo(row: Record<string, any>): Session {
  const folder = row.materials_folder_url
    ? materialsFolderUrl.safeParse(row.materials_folder_url)
    : null;
  return {
    ...sessionSummary(row),
    termId: row.term_id,
    academicYearId: row.academic_year_id,
    description: row.description,
    location: row.location ?? "",
    materialsFolderUrl: folder?.success ? folder.data : null,
    materialsUnavailable: folder?.success === false,
  };
}

import type postgres from "postgres";
import type { CurrentUser } from "../auth/current-user.ts";
import { BackendError, clientError } from "../server/errors.ts";
import {
  getCurrentCalendar,
  getCalendarHierarchy,
  getUpcomingSessions,
  getSessionDetail,
  getSessionSummaries,
} from "../sessions/calendar.ts";
import { getOwnMemberDetail } from "../membership/operations.ts";
import {
  getOwnAttendanceSummary,
  getOwnAbsenceNotices,
} from "../attendance/operations.ts";
import { getPublishedAnnouncements } from "../content/operations.ts";
import { sessionInfo, sessionSummary } from "./session.ts";
import type {
  Read,
  SessionSummary,
  AcademicYear,
  Term,
  PersonalData,
  DashboardData,
} from "./types.ts";

export function requireDashboardUser(user: CurrentUser) {
  if (!user.member && !user.admin)
    throw new BackendError("FORBIDDEN", "Member access is required.", 403);
}
async function read<T>(work: () => PromiseLike<T>): Promise<Read<T>> {
  try {
    return { status: "available", data: await work() };
  } catch (error) {
    const safe = clientError(error);
    if (safe.status === 401 || safe.status === 403) throw safe;
    return { status: "unavailable" };
  }
}
const iso = (value: Date | string) => new Date(value).toISOString();
const day = (value: Date | string) => iso(value).slice(0, 10);
const yearInfo = (row: postgres.Row): AcademicYear => ({
  id: row.id,
  name: row.name,
  startYear: row.start_year,
  startsOn: day(row.starts_on),
  endsOn: day(row.ends_on),
});
const termInfo = (row: postgres.Row): Term => ({
  id: row.id,
  academicYearId: row.academic_year_id,
  name: row.name,
  startsOn: day(row.starts_on),
  endsOn: day(row.ends_on),
});
async function readMember(sql: postgres.Sql, user: CurrentUser) {
  return read(async () => {
    try {
      const { member } = await getOwnMemberDetail(sql, user.id);
      return { displayName: member.display_name, status: member.status };
    } catch (error) {
      if (clientError(error).status === 404) return null;
      throw error;
    }
  });
}
export async function getPersonalData(
  sql: postgres.Sql,
  user: CurrentUser,
): Promise<PersonalData> {
  requireDashboardUser(user);
  const member = await readMember(sql, user);
  if (member.status === "unavailable")
    return {
      identityId: user.id,
      member,
      attendance: { status: "unavailable" },
      notices: { status: "unavailable" },
    };
  if (!member.data)
    return {
      identityId: user.id,
      member,
      attendance: { status: "available", data: null },
      notices: { status: "available", data: null },
    };
  const [attendance, notices] = await Promise.all([
    read(() => getOwnAttendanceSummary(sql, user.id)),
    read(() => getOwnAbsenceNotices(sql, user.id)),
  ]);
  const ids = new Set<string>();
  if (attendance.status === "available")
    attendance.data.records.forEach((r) => ids.add(r.sessionId));
  if (notices.status === "available")
    notices.data.forEach((r) => {
      if (r.sessionId) ids.add(r.sessionId);
    });
  const summaries = await read(() =>
    getSessionSummaries(sql, user.id, [...ids]),
  );
  const byId = new Map<string, SessionSummary>(
    summaries.status === "available"
      ? summaries.data.map((row) => [row.id, sessionSummary(row)])
      : [],
  );
  return {
    identityId: user.id,
    member,
    attendance:
      attendance.status === "available"
        ? {
            status: "available",
            data: {
              summary: attendance.data.summary,
              records: attendance.data.records
                .map((row) => ({
                  ...row,
                  session: byId.get(row.sessionId) ?? null,
                }))
                .sort(
                  (a, b) =>
                    (b.session?.startsAt ?? "").localeCompare(
                      a.session?.startsAt ?? "",
                    ) || a.sessionId.localeCompare(b.sessionId),
                ),
            },
          }
        : attendance,
    notices:
      notices.status === "available"
        ? {
            status: "available",
            data: notices.data.map((row) => ({
              id: row.id,
              sessionId: row.sessionId,
              sessionDate: row.sessionDate ? day(row.sessionDate) : null,
              reason: row.reason,
              status: row.status,
              revision: row.revision,
              createdAt: iso(row.createdAt),
              session: byId.get(row.sessionId) ?? null,
            })),
          }
        : notices,
  };
}
export async function getDashboardData(
  sql: postgres.Sql,
  user: CurrentUser,
): Promise<DashboardData> {
  requireDashboardUser(user);
  const [hierarchy, calendar, nextSession, personal, announcements] =
    await Promise.all([
      read(async () => {
        const data = await getCalendarHierarchy(sql, user.id);
        return {
          academicYears: data.academicYears.map(yearInfo),
          terms: data.terms.map(termInfo),
        };
      }),
      read(async () => {
        const data = await getCurrentCalendar(sql, user.id);
        return data
          ? {
              academicYear: yearInfo(data.academicYear),
              term: data.term ? termInfo(data.term) : null,
              sessions: data.sessions.map(sessionInfo),
            }
          : null;
      }),
      read(async () => {
        const rows = await getUpcomingSessions(sql, user.id, 1);
        return rows[0] ? sessionInfo(rows[0]) : null;
      }),
      getPersonalData(sql, user),
      read(async () =>
        (await getPublishedAnnouncements(sql)).slice(0, 3).map((row) => ({
          id: row.id,
          title: row.title,
          body: row.body,
          publishedAt: iso(row.published_at),
          imageId: row.image_id,
          imageAlt: row.image_alt ?? "",
          imageWidth: row.image_width,
          imageHeight: row.image_height,
          additionalImages: row.additional_images,
        })),
      ),
    ]);
  return {
    identityId: user.id,
    admin: user.admin,
    hierarchy,
    calendar,
    nextSession,
    personal,
    announcements,
  };
}
export async function getSessionPageData(
  sql: postgres.Sql,
  user: CurrentUser,
  id: string,
) {
  requireDashboardUser(user);
  const [row, member] = await Promise.all([
    getSessionDetail(sql, user.id, id),
    readMember(sql, user),
  ]);
  return {
    identityId: user.id,
    session: sessionInfo(row),
    canReportAbsence:
      member.status === "available" ? Boolean(member.data) : null,
  };
}

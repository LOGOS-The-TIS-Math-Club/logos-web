import type {
  AttendanceStatus,
  attendanceSummary,
} from "../attendance/summary.ts";
export type Read<T> =
  { status: "available"; data: T } | { status: "unavailable" };
export type ProtectedState<T> =
  | { status: "ready"; data: T }
  | {
      status:
        "anonymous" | "denied" | "unconfigured" | "unavailable" | "missing";
    };
export interface AcademicYear {
  id: string;
  name: string;
  startYear: number;
  startsOn: string;
  endsOn: string;
}
export interface Term {
  id: string;
  academicYearId: string;
  name: string;
  startsOn: string;
  endsOn: string;
}
export interface SessionSummary {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  status: "scheduled" | "cancelled";
}
export interface Session extends SessionSummary {
  termId: string | null;
  academicYearId: string;
  description: string;
  location: string;
  materialsFolderUrl: string | null;
  materialsUnavailable: boolean;
}
export interface Notice {
  id: string;
  sessionId: string | null;
  sessionDate: string | null;
  reason: string;
  status: "submitted" | "acknowledged" | "cancelled";
  revision: number;
  createdAt: string;
  session: SessionSummary | null;
}
export interface AttendanceData {
  records: {
    sessionId: string;
    status: AttendanceStatus;
    session: SessionSummary | null;
  }[];
  summary: ReturnType<typeof attendanceSummary>;
}
export interface PersonalData {
  identityId: string;
  member: Read<{ displayName: string; status: string | null } | null>;
  attendance: Read<AttendanceData | null>;
  notices: Read<Notice[] | null>;
}
export interface CalendarData {
  academicYear: AcademicYear;
  term: Term | null;
  sessions: Session[];
}
export interface DashboardData {
  identityId: string;
  admin: boolean;
  hierarchy: Read<{ academicYears: AcademicYear[]; terms: Term[] }>;
  calendar: Read<CalendarData | null>;
  nextSession: Read<Session | null>;
  personal: PersonalData;
  announcements: Read<
    {
      id: string;
      title: string;
      body: string;
      publishedAt: string;
      imageId: string | null;
      imageAlt: string;
      imageWidth: number | null;
      imageHeight: number | null;
    }[]
  >;
}

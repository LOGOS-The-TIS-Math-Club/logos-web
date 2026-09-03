import { z } from "zod";

export const ATTENDANCE_STATUSES = [
  "unmarked",
  "present",
  "late",
  "excused_absence",
  "unexcused_absence",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const EXPECTED_ABSENCE_STATUSES = [
  "submitted",
  "acknowledged",
  "cancelled",
] as const;
export type ExpectedAbsenceStatus = (typeof EXPECTED_ABSENCE_STATUSES)[number];

export const CreateSessionSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(120, "Title must not exceed 120 characters")
    .default("LOGOS Weekly Meeting"),
  sessionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  startTime: z.string().min(1).max(10).default("15:30"),
  endTime: z.string().min(1).max(10).default("16:30"),
  location: z.string().min(1).max(100).default("Room 101"),
  notes: z.string().max(500, "Notes must not exceed 500 characters").optional(),
});
export type CreateSessionInput = z.infer<typeof CreateSessionSchema>;

/*
 * Editing an existing session. Deliberately not CreateSessionSchema.partial():
 * that schema carries .default() on most fields, so an omitted key would be
 * silently rewritten to the default rather than left alone — a partial edit of
 * the title would reset the room and the times.
 */
export const UpdateSessionSchema = z
  .object({
    title: z
      .string()
      .min(1, "Title is required")
      .max(120, "Title must not exceed 120 characters"),
    sessionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
    startTime: z.string().min(1).max(10),
    endTime: z.string().min(1).max(10),
    location: z.string().min(1).max(100),
    notes: z
      .string()
      .max(500, "Notes must not exceed 500 characters")
      .nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });
export type UpdateSessionInput = z.infer<typeof UpdateSessionSchema>;

/** What the public pages show. No attendance counts, no identifiers beyond the id. */
export interface PublicSession {
  id: string;
  title: string;
  sessionDate: string;
  notes: string | null;
}

export const RecordAttendanceItemSchema = z.object({
  memberId: z.string().uuid("Invalid member ID"),
  status: z.enum(ATTENDANCE_STATUSES),
  notes: z.string().max(256, "Notes must not exceed 256 characters").optional(),
});
export type RecordAttendanceItem = z.infer<typeof RecordAttendanceItemSchema>;

export const RecordAttendanceBatchSchema = z.object({
  sessionId: z.string().uuid("Invalid session ID"),
  records: z.array(RecordAttendanceItemSchema),
});
export type RecordAttendanceBatchInput = z.infer<
  typeof RecordAttendanceBatchSchema
>;

export const SubmitExpectedAbsenceSchema = z.object({
  sessionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  sessionId: z.string().uuid("Invalid session ID").optional(),
  reason: z
    .string()
    .min(1, "Reason is required")
    .max(500, "Reason must not exceed 500 characters"),
  memberId: z.string().uuid("Invalid member ID").optional(), // Optional: for leadership submitting on behalf of member
});
export type SubmitExpectedAbsenceInput = z.infer<
  typeof SubmitExpectedAbsenceSchema
>;

export const IssueWarningSchema = z.object({
  memberId: z.string().uuid("Invalid member ID"),
  reason: z
    .string()
    .min(1, "Reason is required")
    .max(256, "Reason must not exceed 256 characters"),
  notes: z.string().max(500, "Notes must not exceed 500 characters").optional(),
});
export type IssueWarningInput = z.infer<typeof IssueWarningSchema>;

export const ResolveWarningSchema = z.object({
  warningId: z.string().uuid("Invalid warning ID"),
});
export type ResolveWarningInput = z.infer<typeof ResolveWarningSchema>;

export interface SessionListItem {
  id: string;
  title: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  location: string;
  notes: string | null;
  createdAt: string;
  presentCount: number;
  totalMarked: number;
}

export interface MemberSessionAttendance {
  memberId: string;
  preferredName: string;
  email: string;
  grade: string | null;
  status: AttendanceStatus;
  notes: string | null;
  expectedAbsence: {
    id: string;
    reason: string;
    status: ExpectedAbsenceStatus;
  } | null;
}

export interface AttendanceTotals {
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  excusedCount: number;
  unexcusedCount: number;
  unmarkedCount: number;
  attendanceRate: number; // percentage 0 - 100
}

export interface WarningListItem {
  id: string;
  memberId: string;
  memberName: string;
  memberEmail: string;
  reason: string;
  notes: string | null;
  active: boolean;
  issuedAt: string;
  resolvedAt: string | null;
}

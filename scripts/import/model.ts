import { createHash } from "node:crypto";
import { z } from "zod";

// Source data is JSON returned by PostgreSQL, not values interpreted as JS dates.
export type Row = Record<string, any>;
export type Tables = Record<string, Row[]>;
export const decisionsInput = z.object({
  preserveRecordedJoinDates: z.literal(true),
  formerReasons: z.record(z.uuid(), z.enum(["quit", "removed", "graduated"])),
  terms: z.array(
    z.object({
      id: z.uuid(),
      academicYear: z.number().int(),
      name: z.string().min(1),
      startsOn: z.iso.date(),
      endsOn: z.iso.date(),
    }),
  ),
  approvedAdminIdentityIds: z.array(z.uuid()),
  absenceSessionOverrides: z.record(z.uuid(), z.uuid().nullable()).default({}),
  approvedMaterialsFolders: z.array(z.string()),
});
export type Decisions = z.infer<typeof decisionsInput>;
export type Finding = {
  kind: string;
  ids: string[];
  detail: string;
  blocksCutover: boolean;
};
export const sourceNames = [
  "people.application_identities",
  "people.affiliation_evidence",
  "people.technical_access_assignments",
  "applications.student_applications",
  "members.club_members",
  "members.member_warnings",
  "meetings.club_sessions",
  "meetings.session_attendance",
  "meetings.expected_absences",
  "content.images",
  "content.announcements",
  "content.story_entries",
  "content.club_resources",
  "operations.business_audit_journal",
] as const;
export function stableId(value: string): string {
  const h = createHash("sha256").update(`logos-import:${value}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-8${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
export function tokyoDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error("Invalid source timestamp");
  return new Date(date.getTime() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}
export function academicYear(date: string): number {
  return Number(date.slice(0, 4)) - (Number(date.slice(5, 7)) < 8 ? 1 : 0);
}
export function assertImport(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function hash(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

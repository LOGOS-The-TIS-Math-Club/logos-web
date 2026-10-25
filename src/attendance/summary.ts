export type AttendanceStatus =
  "present" | "late" | "excused_absence" | "unexcused_absence" | "unmarked";

// Input comes from meetings.eligible_attendance, which owns historical eligibility.
export function attendanceSummary(
  records: readonly { status: AttendanceStatus }[],
) {
  const counts = {
    present: 0,
    late: 0,
    excused_absence: 0,
    unexcused_absence: 0,
    unmarked: 0,
  };
  for (const { status } of records) counts[status]++;
  const attended = counts.present + counts.late;
  const denominator = attended + counts.unexcused_absence;
  return {
    counts,
    eligibleSessions: records.length,
    attended,
    denominator,
    pending: counts.unmarked,
    percentage:
      denominator === 0 ? null : Math.round((attended / denominator) * 100),
  };
}

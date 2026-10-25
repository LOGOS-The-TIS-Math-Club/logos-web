export function academicYearAt(instant: Date): number {
  if (!Number.isFinite(instant.getTime())) throw new Error("Invalid date");
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "numeric",
  }).formatToParts(instant);
  const year = Number(parts.find((p) => p.type === "year")!.value);
  return Number(parts.find((p) => p.type === "month")!.value) >= 8
    ? year
    : year - 1;
}

// Updating the baseline grade/year is the manual override; it then progresses normally.
export function gradeAt(
  grade: number,
  gradeAcademicYear: number,
  instant: Date,
): number | "graduated" {
  if (
    !Number.isInteger(grade) ||
    grade < 9 ||
    grade > 12 ||
    !Number.isInteger(gradeAcademicYear)
  )
    throw new Error("Invalid grade baseline");
  const current =
    grade + Math.max(0, academicYearAt(instant) - gradeAcademicYear);
  return current > 12 ? "graduated" : current;
}

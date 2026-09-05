import { GRADES, type Grade } from "@/lib/applications/schema";

/*
 * Which grade a member is in now.
 *
 * The school year turns over in September, but August 1 sits in the middle of
 * the summer break — nobody is at school, and no one thinks of themselves as
 * being in last year's grade by then. So August 1 is the rollover: a student
 * who applied in Grade 9 during the 2026 school year is a Grade 10 from
 * 1 August 2027.
 *
 * This is computed on read rather than written by a scheduled job. A job that
 * rewrites every member's grade once a year has to run exactly once: miss it
 * (a failed deploy, a disabled cron, a quiet Vercel account) and every grade is
 * silently a year stale, run it twice and everybody jumps two years. Deriving
 * it means the answer is right on August 1 without anything having to happen,
 * and it self-corrects if the site was down that week.
 *
 * An operator can still override it — students repeat years, skip years, and
 * join mid-year — see gradeOverride on club_members.
 */

export const GRADUATED = "Graduated";

/** Tokyo, because that is where the school is and where August 1 lands. */
const SCHOOL_TIME_ZONE = "Asia/Tokyo";

const tokyoParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHOOL_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/**
 * The school year a date falls in, labelled by the calendar year it began in.
 *
 * August to December belong to the year that has just started; January to July
 * belong to the year before.
 */
export function academicYear(date: Date): number {
  const parts = tokyoParts.formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  // August is month 8 in this formatting, and is the first month of the new
  // school year.
  return month >= 8 ? year : year - 1;
}

function gradeNumber(grade: string): number | null {
  const match = /^Grade (\d{1,2})$/.exec(grade.trim());
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/**
 * Advances an applied grade by the school years elapsed since the cohort year.
 *
 * Returns "Graduated" past Grade 12, and never goes backwards: a cohort year in
 * the future (bad data, or a member recorded early) leaves the grade as
 * applied rather than producing "Grade 8".
 */
export function advanceGrade(
  appliedGrade: string,
  cohortYear: number,
  today: Date,
): string {
  const start = gradeNumber(appliedGrade);
  if (start === null) return appliedGrade;

  const elapsed = academicYear(today) - cohortYear;
  if (elapsed <= 0) return appliedGrade;

  const current = start + elapsed;
  if (current > 12) return GRADUATED;

  return `Grade ${current}`;
}

/**
 * The grade to show for a member.
 *
 * An operator override wins outright — it exists precisely for the cases this
 * arithmetic cannot know about. Otherwise the applied grade is advanced from
 * the cohort year, falling back to the year the application was submitted when
 * no cohort year was recorded, which is what it means for every member who
 * joined before this field existed.
 */
export function resolveMemberGrade(input: {
  gradeOverride?: string | null;
  appliedGrade?: string | null;
  cohortYear?: number | null;
  appliedAt?: Date | string | null;
  today?: Date;
}): string | null {
  if (input.gradeOverride) return input.gradeOverride;
  if (!input.appliedGrade) return null;

  const today = input.today ?? new Date();

  let cohortYear = input.cohortYear ?? null;
  if (cohortYear === null && input.appliedAt) {
    const appliedAt =
      input.appliedAt instanceof Date
        ? input.appliedAt
        : new Date(input.appliedAt);
    if (!Number.isNaN(appliedAt.getTime())) {
      cohortYear = academicYear(appliedAt);
    }
  }

  // Nothing to measure from: report the grade as applied rather than guessing.
  if (cohortYear === null) return input.appliedGrade;

  return advanceGrade(input.appliedGrade, cohortYear, today);
}

/** Grades an operator may pick, plus the post-Grade-12 state. */
export const GRADE_OPTIONS = [...GRADES, GRADUATED] as const;
export type GradeOption = Grade | typeof GRADUATED;

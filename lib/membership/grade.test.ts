import { describe, expect, it } from "vitest";

import {
  academicYear,
  advanceGrade,
  GRADUATED,
  resolveMemberGrade,
} from "./grade";

describe("academicYear", () => {
  it("treats August as the start of the new school year", () => {
    // The school year starts in September, but August 1 is mid-summer break —
    // nobody thinks of themselves as being in last year's grade by then.
    expect(academicYear(new Date("2026-08-01T00:00:00+09:00"))).toBe(2026);
  });

  it("treats 31 July as still the previous school year", () => {
    expect(academicYear(new Date("2026-07-31T23:59:00+09:00"))).toBe(2025);
  });

  it("keeps September through December in the year that just started", () => {
    expect(academicYear(new Date("2026-09-04T00:00:00+09:00"))).toBe(2026);
    expect(academicYear(new Date("2026-12-31T00:00:00+09:00"))).toBe(2026);
  });

  it("keeps January through July in the year before", () => {
    expect(academicYear(new Date("2027-01-01T00:00:00+09:00"))).toBe(2026);
    expect(academicYear(new Date("2027-06-30T00:00:00+09:00"))).toBe(2026);
  });

  it("uses Tokyo time, not UTC", () => {
    /*
     * 31 July 22:00 UTC is already 1 August in Tokyo. Computing in UTC would
     * roll every student's grade over nine hours late — visible to anyone
     * looking at the site on the morning of the 1st.
     */
    expect(academicYear(new Date("2026-07-31T22:00:00Z"))).toBe(2026);
  });
});

describe("advanceGrade", () => {
  it("holds the grade during the year they applied", () => {
    expect(
      advanceGrade("Grade 9", 2026, new Date("2026-09-04T00:00:00+09:00")),
    ).toBe("Grade 9");
  });

  it("advances on 1 August, not in September", () => {
    expect(
      advanceGrade("Grade 9", 2026, new Date("2027-07-31T00:00:00+09:00")),
    ).toBe("Grade 9");
    expect(
      advanceGrade("Grade 9", 2026, new Date("2027-08-01T00:00:00+09:00")),
    ).toBe("Grade 10");
  });

  it("advances by however many years have passed", () => {
    expect(
      advanceGrade("Grade 9", 2026, new Date("2029-09-01T00:00:00+09:00")),
    ).toBe("Grade 12");
  });

  it("reports Graduated past Grade 12", () => {
    expect(
      advanceGrade("Grade 12", 2026, new Date("2027-08-01T00:00:00+09:00")),
    ).toBe(GRADUATED);
    expect(
      advanceGrade("Grade 9", 2026, new Date("2035-09-01T00:00:00+09:00")),
    ).toBe(GRADUATED);
  });

  it("never goes backwards from a cohort year in the future", () => {
    // Bad data should not produce "Grade 8", which does not exist here.
    expect(
      advanceGrade("Grade 9", 2030, new Date("2026-09-01T00:00:00+09:00")),
    ).toBe("Grade 9");
  });

  it("passes an unrecognised grade through untouched", () => {
    expect(
      advanceGrade("Sixth Form", 2026, new Date("2029-09-01T00:00:00+09:00")),
    ).toBe("Sixth Form");
  });
});

describe("resolveMemberGrade", () => {
  const today = new Date("2028-09-04T00:00:00+09:00");

  it("lets an operator override win outright", () => {
    // Students repeat years and skip years; the override exists for exactly
    // what the arithmetic cannot know.
    expect(
      resolveMemberGrade({
        gradeOverride: "Grade 11",
        appliedGrade: "Grade 9",
        cohortYear: 2026,
        today,
      }),
    ).toBe("Grade 11");
  });

  it("advances from the recorded cohort year", () => {
    expect(
      resolveMemberGrade({ appliedGrade: "Grade 9", cohortYear: 2026, today }),
    ).toBe("Grade 11");
  });

  it("falls back to the application date when no cohort year was recorded", () => {
    // What every member who joined before the column existed looks like.
    expect(
      resolveMemberGrade({
        appliedGrade: "Grade 9",
        cohortYear: null,
        appliedAt: "2026-09-10T00:00:00+09:00",
        today,
      }),
    ).toBe("Grade 11");
  });

  it("reports the applied grade when there is nothing to measure from", () => {
    expect(resolveMemberGrade({ appliedGrade: "Grade 10", today })).toBe(
      "Grade 10",
    );
  });

  it("ignores an unparseable application date rather than throwing", () => {
    expect(
      resolveMemberGrade({
        appliedGrade: "Grade 10",
        appliedAt: "not a date",
        today,
      }),
    ).toBe("Grade 10");
  });

  it("returns null when no grade is known at all", () => {
    expect(resolveMemberGrade({ appliedGrade: null, today })).toBeNull();
  });
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { academicYearAt, gradeAt } from "../src/membership/grade.ts";
import { attendanceSummary } from "../src/attendance/summary.ts";
import { storyInput } from "../src/content/input.ts";
import { sessionInput, materialsFolderUrl } from "../src/sessions/input.ts";
import { applicationInput } from "../src/applications/input.ts";

test("August 1 rollover uses Tokyo even when UTC is July 31", () => {
  assert.equal(academicYearAt(new Date("2027-07-31T14:59:59Z")), 2026);
  assert.equal(academicYearAt(new Date("2027-07-31T15:00:00Z")), 2027);
  assert.equal(gradeAt(9, 2026, new Date("2027-07-31T15:00:00Z")), 10);
  assert.equal(
    gradeAt(12, 2026, new Date("2027-08-01T00:00:00Z")),
    "graduated",
  );
  assert.equal(gradeAt(10, 2027, new Date("2027-08-01T00:00:00Z")), 10);
  assert.throws(() => gradeAt(8, 2026, new Date()));
});
test("attendance counts late, excludes excused and pending, and reports no-data as null", () => {
  const result = attendanceSummary(
    ["present", "late", "excused_absence", "unexcused_absence", "unmarked"].map(
      (status) => ({
        status:
          status as import("../src/attendance/summary.ts").AttendanceStatus,
      }),
    ),
  );
  assert.equal(result.attended, 2);
  assert.equal(result.denominator, 3);
  assert.equal(result.percentage, 67);
  assert.equal(result.pending, 1);
  assert.equal(attendanceSummary([]).percentage, null);
  assert.equal(
    attendanceSummary([{ status: "excused_absence" }]).percentage,
    null,
  );
});
test("story description is optional and empty is valid; date must exist", () => {
  assert.equal(
    storyInput.parse({ title: "Story", occurredOn: "2026-10-25" }).description,
    "",
  );
  assert.equal(
    storyInput.safeParse({ title: "Story", occurredOn: "2026-02-30" }).success,
    false,
  );
});
test("session boundary validates real dates, local time, positive duration, and specific Drive folders", () => {
  const v = {
    termId: "10000000-0000-4000-8000-000000000001",
    date: "2026-10-25",
    startTime: "15:30",
    durationMinutes: 60,
    title: "Math",
  };
  assert.equal(sessionInput.safeParse(v).success, true);
  for (const bad of [
    { date: "2026-02-30" },
    { startTime: "24:00" },
    { durationMinutes: 0 },
  ])
    assert.equal(sessionInput.safeParse({ ...v, ...bad }).success, false);
  assert.equal(
    materialsFolderUrl.safeParse(
      "https://drive.google.com/drive/folders/abc_123?usp=sharing",
    ).success,
    true,
  );
  for (const url of [
    "https://drive.google.com/file/d/abc/view",
    "https://evil.test/drive/folders/abc",
    "javascript:alert(1)",
    "https://drive.google.com@evil.test/drive/folders/abc",
  ])
    assert.equal(materialsFolderUrl.safeParse(url).success, false);
});
test("legacy application questions retained and course refusal normalizes to null", () => {
  const v = {
    preferredName: " Student ",
    grade: 9,
    gradeAcademicYear: 2026,
    academicInterests: ["algebra"],
    joinReason: "a".repeat(30),
    goals: "b".repeat(30),
    mathCourse: "prefer_not_to_say",
    contestInterest: "maybe",
    presentInterest: "no",
    attendanceConfirmation: "regular",
    accuracyAcknowledged: true,
  };
  assert.equal(applicationInput.parse(v).mathCourse, null);
  assert.equal(applicationInput.parse(v).preferredName, "Student");
  assert.equal(
    applicationInput.safeParse({ ...v, accuracyAcknowledged: false }).success,
    false,
  );
});

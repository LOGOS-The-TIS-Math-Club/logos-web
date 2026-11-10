import assert from "node:assert/strict";
import test from "node:test";
import { attendanceSummary } from "../src/attendance/summary.ts";
import {
  attendanceText,
  displayDay,
  monthDays,
  sessionTime,
  shiftMonth,
  tokyoDay,
} from "../src/dashboard/presentation.ts";
import { sessionInfo } from "../src/dashboard/session.ts";
test("dashboard dates preserve Tokyo days and show a midnight-crossing session end", () => {
  const session = sessionInfo({
    id: "synthetic",
    title: "Test",
    starts_at: "2026-11-01T14:30:00Z",
    ends_at: "2026-11-01T15:30:00Z",
    duration_minutes: 60,
    status: "scheduled",
    description: "",
    academic_year_id: "year",
    term_id: "term",
    materials_folder_url: null,
  });
  assert.equal(tokyoDay(session.startsAt), "2026-11-01");
  assert.equal(tokyoDay(session.endsAt), "2026-11-02");
  assert.equal(displayDay("2026-11-02"), "2026/11/02");
  assert.equal(sessionTime(session), "23:30-2026/11/02 00:30 JST");
});
test("calendar weeks start Monday, include leap days, and cross year boundaries", () => {
  const days = monthDays("2024-02");
  assert.equal(days.length % 7, 0);
  assert.equal(days[0], null);
  assert.equal(days[3], "2024-02-01");
  assert.ok(days.includes("2024-02-29"));
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
});
test("attendance presentation keeps no records, unsettled records, and zero percent distinct", () => {
  assert.equal(
    attendanceText(attendanceSummary([])),
    "No eligible sessions yet",
  );
  assert.equal(
    attendanceText(attendanceSummary([{ status: "unmarked" }])),
    "No settled attendance percentage yet",
  );
  assert.equal(
    attendanceText(attendanceSummary([{ status: "unexcused_absence" }])),
    "0% attendance",
  );
});
test("session DTOs expose a specific Drive folder only and omit administrative identities", () => {
  const raw = {
    id: "synthetic",
    title: "Test",
    starts_at: "2026-11-01T05:00:00Z",
    ends_at: "2026-11-01T06:00:00Z",
    duration_minutes: 60,
    status: "scheduled",
    description: "",
    academic_year_id: "year",
    term_id: "term",
    created_by: "private-id",
    materials_folder_url:
      "https://drive.google.com/drive/u/0/folders/synthetic_folder",
  };
  assert.equal(sessionInfo(raw).materialsFolderUrl, raw.materials_folder_url);
  assert.equal("created_by" in sessionInfo(raw), false);
  assert.equal(
    sessionInfo({ ...raw, materials_folder_url: "javascript:alert(1)" })
      .materialsFolderUrl,
    null,
  );
  assert.equal(
    sessionInfo({ ...raw, materials_folder_url: "https://drive.google.com/" })
      .materialsUnavailable,
    true,
  );
});

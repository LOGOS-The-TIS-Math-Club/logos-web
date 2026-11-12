import { isLeadershipPath } from "../src/admin/navigation.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  sessionEditorDateTime,
  dateInputValue,
  shiftCalendarDay,
} from "../src/admin/presentation.ts";
import { recurringInput } from "../src/sessions/recurring.ts";
test("session editing restores Tokyo date and time from an unambiguous instant", () => {
  assert.deepEqual(sessionEditorDateTime("2026-11-02T06:30:00.000Z"), {
    date: "2026-11-02",
    time: "15:30",
  });
  assert.deepEqual(sessionEditorDateTime("2026-11-02T15:30:00.000Z"), {
    date: "2026-11-03",
    time: "00:30",
  });
});
test("recurring settings remain withheld by default and validate public schedule fields", () => {
  assert.equal(
    recurringInput.parse({
      weekday: 5,
      startTime: "15:30",
      durationMinutes: 60,
    }).published,
    false,
  );
  for (const change of [
    { weekday: 7 },
    { startTime: "24:00" },
    { durationMinutes: 0 },
    { room: "x".repeat(121) },
  ])
    assert.equal(
      recurringInput.safeParse({
        weekday: 5,
        startTime: "15:30",
        durationMinutes: 60,
        ...change,
      }).success,
      false,
    );
});

test("native date inputs preserve date-only days from serialized database values", () => {
  assert.equal(dateInputValue("2030-08-01T00:00:00.000Z"), "2030-08-01");
  assert.equal(dateInputValue("2030-08-01"), "2030-08-01");
});

test("term last days round-trip through the exclusive API boundary", () => {
  for (const [lastDay, boundary] of [
    ["2026-11-13", "2026-11-14"],
    ["2026-12-31", "2027-01-01"],
    ["2028-02-29", "2028-03-01"],
  ] as const) {
    assert.equal(shiftCalendarDay(lastDay, 1), boundary);
    assert.equal(shiftCalendarDay(`${boundary}T00:00:00.000Z`, -1), lastDay);
  }
  assert.equal(shiftCalendarDay("", 1), "");
});

test("leadership destinations accept implemented tools and reject unfinished paths", () => {
  for (const path of [
    "/admin",
    "/admin/schedule",
    "/admin/sessions/calendar",
    "/admin/content/stories/new",
    "/admin/content/club-info/edit",
  ])
    assert.equal(isLeadershipPath(path), true);
  for (const path of [
    "/admin/settings",
    "/admin/schedule/new",
    "/admin/members/not-an-id",
    "/admin/content/unknown/new",
    "/admin/content/stories/new/extra",
  ])
    assert.equal(isLeadershipPath(path), false);
});

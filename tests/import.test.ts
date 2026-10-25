import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  tokyoDate,
  academicYear,
  stableId,
  canonical,
  decisionsInput,
} from "../scripts/import/model.ts";
import { termInput } from "../src/sessions/calendar.ts";

test("import converts UTC timestamps into whole Tokyo membership dates", () => {
  assert.equal(tokyoDate("2026-09-24T15:25:18.864846+00:00"), "2026-09-25");
  assert.equal(tokyoDate("2026-10-03T14:04:00.068+00:00"), "2026-10-03");
  assert.equal(academicYear("2026-07-31"), 2025);
  assert.equal(academicYear("2026-08-01"), 2026);
});
test("stable import IDs are repeatable valid UUIDs without using names or emails", () => {
  assert.equal(stableId("year:2026"), stableId("year:2026"));
  assert.notEqual(stableId("year:2026"), stableId("year:2027"));
  assert.equal(z.uuid().safeParse(stableId("year:2026")).success, true);
});
test("private decisions require preserving source join dates and explicit valid departure reasons", () => {
  const decisions = {
    preserveRecordedJoinDates: true,
    formerReasons: {},
    terms: [],
    approvedAdminIdentityIds: [],
    approvedMaterialsFolders: [],
  };
  assert.equal(decisionsInput.safeParse(decisions).success, true);
  assert.equal(
    decisionsInput.safeParse({ ...decisions, preserveRecordedJoinDates: false })
      .success,
    false,
  );
  assert.equal(
    decisionsInput.safeParse({
      ...decisions,
      formerReasons: { "not-an-id": "quit" },
    }).success,
    false,
  );
});
test("calendar input requires real dates and an exclusive end after its start", () => {
  const term = {
    id: stableId("term:1"),
    academicYearId: stableId("year:2026"),
    name: "Term 1",
    startsOn: "2026-09-01",
    endsOn: "2026-12-20",
  };
  assert.equal(termInput.safeParse(term).success, true);
  assert.equal(
    termInput.safeParse({ ...term, endsOn: "2026-09-01" }).success,
    false,
  );
  assert.equal(
    termInput.safeParse({ ...term, startsOn: "2026-02-30" }).success,
    false,
  );
});
test("content comparison is independent of object key order", () => {
  assert.equal(
    canonical({ a: 1, b: { x: null, y: 2 } }),
    canonical({ b: { y: 2, x: null }, a: 1 }),
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { formatDisplayDate } from "../src/presentation/date.ts";

test("display dates use year, zero-padded month, then day", () => {
  assert.equal(
    formatDisplayDate(new Date("2026-10-01T00:00:00Z")),
    "2026/10/01",
  );
  assert.equal(
    formatDisplayDate(new Date("2026-01-23T00:00:00Z")),
    "2026/01/23",
  );
  assert.equal(
    formatDisplayDate(new Date("2024-02-29T00:00:00Z")),
    "2024/02/29",
  );
});

test("timestamp dates follow Tokyo while date-only records retain their calendar day", () => {
  const boundary = new Date("2026-12-31T15:30:00Z");
  assert.equal(formatDisplayDate(boundary), "2027/01/01");
  assert.equal(formatDisplayDate(boundary, "UTC"), "2026/12/31");
});

import { describe, expect, it } from "vitest";

import {
  formatSessionDate,
  SESSIONS,
  splitSessions,
  type SessionEntry,
} from "@/content/club";

const FIXTURE: readonly SessionEntry[] = [
  { date: "2026-09-04", topic: "One" },
  { date: "2026-09-11", topic: "Two" },
  { date: "2026-09-18", topic: "Three" },
];

describe("splitSessions", () => {
  it("returns nothing past and the first session as next before the term starts", () => {
    const { past, next } = splitSessions(FIXTURE, new Date("2026-08-01"));
    expect(past).toHaveLength(0);
    expect(next?.topic).toBe("One");
  });

  it("treats a session happening today as already past", () => {
    const { past, next } = splitSessions(FIXTURE, new Date("2026-09-11"));
    expect(past.map((s) => s.topic)).toEqual(["One", "Two"]);
    expect(next?.topic).toBe("Three");
  });

  it("returns no next session once the term is over", () => {
    const { past, next } = splitSessions(FIXTURE, new Date("2027-01-01"));
    expect(past).toHaveLength(3);
    expect(next).toBeNull();
  });
});

describe("formatSessionDate", () => {
  it("formats in UTC so the date never shifts by timezone", () => {
    // Month abbreviation varies by ICU version ("Sep" vs "Sept"), so assert
    // the parts that matter: the day must not roll back to the 3rd.
    expect(formatSessionDate("2026-09-04")).toMatch(/^4 Sept?\.? 2026$/);
  });
});

describe("SESSIONS", () => {
  it("is ordered by date", () => {
    const dates = SESSIONS.map((s) => s.date);
    expect([...dates].sort()).toEqual(dates);
  });

  it("only lists Fridays, matching the published meeting day", () => {
    for (const session of SESSIONS) {
      const day = new Date(`${session.date}T00:00:00Z`).getUTCDay();
      expect(day, `${session.date} should be a Friday`).toBe(5);
    }
  });
});

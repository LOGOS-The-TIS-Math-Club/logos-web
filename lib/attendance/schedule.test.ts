import { describe, expect, it } from "vitest";

import type { SessionListItem } from "./schema";
import { selectNextUpcomingSession } from "./schedule";

function session(
  id: string,
  sessionDate: string,
  startTime = "15:30",
): SessionListItem {
  return {
    id,
    title: "LOGOS Weekly Meeting",
    sessionDate,
    startTime,
    endTime: "16:30",
    location: "Room 101",
    notes: null,
    driveFolderId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    presentCount: 0,
    totalMarked: 0,
  };
}

describe("selectNextUpcomingSession", () => {
  it("selects the nearest upcoming session from a descending session list", () => {
    const sessions = [
      session("far-future", "2026-10-09"),
      session("next", "2026-09-18"),
      session("past", "2026-09-04"),
    ];

    expect(
      selectNextUpcomingSession(sessions, new Date("2026-09-10T12:00:00Z")),
    ).toMatchObject({ id: "next" });
  });

  it("uses the earliest start time when multiple upcoming sessions share a date", () => {
    const sessions = [
      session("later", "2026-09-18", "16:30"),
      session("earlier", "2026-09-18", "15:30"),
    ];

    expect(
      selectNextUpcomingSession(sessions, new Date("2026-09-10T12:00:00Z")),
    ).toMatchObject({ id: "earlier" });
  });

  it("returns null when every session is in the past", () => {
    expect(
      selectNextUpcomingSession(
        [session("past", "2026-09-04")],
        new Date("2026-09-10T12:00:00Z"),
      ),
    ).toBeNull();
  });
});

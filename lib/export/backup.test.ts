import { describe, expect, it } from "vitest";

import { backupFileName } from "./backup-naming";

describe("backupFileName", () => {
  it("dates the file so runs sort chronologically", () => {
    expect(
      backupFileName("members", new Date("2026-09-04T23:30:00.000Z")),
    ).toBe("logos-2026-09-04-members.csv");
  });

  it("gives each dataset its own file within a run", () => {
    const now = new Date("2026-09-04T00:00:00.000Z");

    expect(backupFileName("members", now)).not.toBe(
      backupFileName("sessions", now),
    );
  });

  it("uses UTC, so a late-evening run in Tokyo does not skip a day", () => {
    // Asia/Tokyo is UTC+9; a local-time implementation would label this file
    // with the following day and leave a gap in the sequence.
    expect(
      backupFileName("members", new Date("2026-09-04T16:00:00.000Z")),
    ).toBe("logos-2026-09-04-members.csv");
  });
});

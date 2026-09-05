import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * getProgramme decides what the public pages show. The database is mocked so
 * these stay pure: what matters is the precedence rule and that a read failure
 * cannot take down the home page.
 */
const listPublicSessions = vi.hoisted(() => vi.fn());

vi.mock("@/lib/attendance/service.server", () => ({ listPublicSessions }));

import { SESSIONS } from "@/content/club";
import { getProgramme } from "./programme.server";

describe("getProgramme", () => {
  beforeEach(() => {
    listPublicSessions.mockReset();
  });

  it("prefers the database once any session exists", async () => {
    listPublicSessions.mockResolvedValue([
      {
        id: "a",
        title: "Projective geometry",
        sessionDate: "2026-10-02",
        notes: "Went well.",
      },
    ]);

    const programme = await getProgramme();

    expect(programme).toEqual([
      {
        date: "2026-10-02",
        topic: "Projective geometry",
        note: "Went well.",
      },
    ]);
  });

  it("maps a null note to undefined so the optional field stays absent", async () => {
    listPublicSessions.mockResolvedValue([
      { id: "a", title: "Induction", sessionDate: "2026-10-09", notes: null },
    ]);

    const [entry] = await getProgramme();

    expect(entry.note).toBeUndefined();
  });

  it("falls back to the committed curriculum while the table is empty", async () => {
    listPublicSessions.mockResolvedValue([]);

    // Otherwise a database with no sessions yet would show an empty programme.
    expect(await getProgramme()).toBe(SESSIONS);
  });

  it("falls back rather than propagating a read failure", async () => {
    listPublicSessions.mockRejectedValue(new Error("connection refused"));

    expect(await getProgramme()).toBe(SESSIONS);
  });

  it("preserves database ordering rather than re-sorting", async () => {
    listPublicSessions.mockResolvedValue([
      { id: "a", title: "First", sessionDate: "2026-09-04", notes: null },
      { id: "b", title: "Second", sessionDate: "2026-09-11", notes: null },
    ]);

    const programme = await getProgramme();

    expect(programme.map((entry) => entry.topic)).toEqual(["First", "Second"]);
  });
});

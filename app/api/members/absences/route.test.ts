import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  submitAbsence: vi.fn(),
}));

vi.mock("@/lib/auth/identity-access.server", () => ({
  AccessDeniedError: class AccessDeniedError extends Error {
    constructor() {
      super("Access denied");
      this.name = "AccessDeniedError";
    }
  },
}));

vi.mock("@/lib/attendance/service.server", () => ({
  submitExpectedAbsence: mocks.submitAbsence,
  MemberNotActiveError: class MemberNotActiveError extends Error {
    constructor() {
      super("Member not active");
      this.name = "MemberNotActiveError";
    }
  },
}));

import { POST } from "./route";

describe("Member Absences API (/api/members/absences)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST submits expected absence", async () => {
    mocks.submitAbsence.mockResolvedValue({
      id: "abs-1",
      sessionDate: "2026-09-04",
      reason: "Music contest",
    });

    const req = new NextRequest("http://localhost/api/members/absences", {
      method: "POST",
      body: JSON.stringify({
        sessionDate: "2026-09-04",
        reason: "Music contest",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.absence.id).toBe("abs-1");
  });
});

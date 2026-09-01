import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSessionAttendance: vi.fn(),
  recordSessionAttendance: vi.fn(),
  requireCapability: vi.fn(),
}));

vi.mock("@/lib/auth/identity-access.server", () => ({
  requireCapability: mocks.requireCapability,
  AccessDeniedError: class AccessDeniedError extends Error {
    constructor() {
      super("Access denied");
      this.name = "AccessDeniedError";
    }
  },
}));

vi.mock("@/lib/attendance/service.server", () => ({
  getSessionAttendance: mocks.getSessionAttendance,
  recordSessionAttendance: mocks.recordSessionAttendance,
  SessionNotFoundError: class SessionNotFoundError extends Error {
    constructor() {
      super("Session not found");
      this.name = "SessionNotFoundError";
    }
  },
}));

import { GET, POST } from "./route";

describe("Admin Attendance API (/api/admin/attendance)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 400 when sessionId is missing", async () => {
    const req = new NextRequest("http://localhost/api/admin/attendance");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("GET returns session attendance when sessionId is provided", async () => {
    mocks.getSessionAttendance.mockResolvedValue({
      session: { id: "123e4567-e89b-42d3-a456-426614174000" },
      roster: [],
    });

    const req = new NextRequest(
      "http://localhost/api/admin/attendance?sessionId=123e4567-e89b-42d3-a456-426614174000",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("POST records attendance ledger entries", async () => {
    mocks.recordSessionAttendance.mockResolvedValue({
      success: true,
      count: 2,
    });

    const req = new NextRequest("http://localhost/api/admin/attendance", {
      method: "POST",
      body: JSON.stringify({
        sessionId: "123e4567-e89b-42d3-a456-426614174000",
        records: [],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
  });
});

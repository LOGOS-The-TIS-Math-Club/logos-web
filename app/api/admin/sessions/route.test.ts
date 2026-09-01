import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listSessions: vi.fn(),
  createSession: vi.fn(),
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
  listClubSessions: mocks.listSessions,
  createClubSession: mocks.createSession,
}));

import { GET, POST } from "./route";

describe("Admin Sessions API (/api/admin/sessions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns session list", async () => {
    mocks.listSessions.mockResolvedValue([
      { id: "session-1", title: "Meeting 1" },
    ]);

    const req = new NextRequest("http://localhost/api/admin/sessions");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sessions.length).toBe(1);
  });

  it("POST creates session and returns 201", async () => {
    mocks.createSession.mockResolvedValue({
      id: "session-1",
      title: "Meeting 1",
      sessionDate: "2026-09-04",
    });

    const req = new NextRequest("http://localhost/api/admin/sessions", {
      method: "POST",
      body: JSON.stringify({
        title: "Meeting 1",
        sessionDate: "2026-09-04",
        startTime: "15:30",
        endTime: "16:30",
        location: "Room 101",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.session.id).toBe("session-1");
  });
});

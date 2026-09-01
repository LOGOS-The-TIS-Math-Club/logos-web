import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listMembers: vi.fn(),
  activateMember: vi.fn(),
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

vi.mock("@/lib/membership/service.server", () => ({
  listMembers: mocks.listMembers,
  activateMemberFromApplication: mocks.activateMember,
  ApplicationNotFoundError: class ApplicationNotFoundError extends Error {
    constructor() {
      super("Application not found");
      this.name = "ApplicationNotFoundError";
    }
  },
  ApplicationNotAcceptedError: class ApplicationNotAcceptedError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "ApplicationNotAcceptedError";
    }
  },
  DuplicateActiveMemberError: class DuplicateActiveMemberError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "DuplicateActiveMemberError";
    }
  },
}));

import { GET, POST } from "./route";

describe("Admin Members API (/api/admin/members)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns member list", async () => {
    mocks.listMembers.mockResolvedValue([
      { id: "member-1", preferredName: "Alice" },
    ]);

    const req = new NextRequest("http://localhost/api/admin/members");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.members.length).toBe(1);
  });

  it("POST activates member and returns 201", async () => {
    mocks.activateMember.mockResolvedValue({
      id: "member-1",
      status: "active",
    });

    const req = new NextRequest("http://localhost/api/admin/members", {
      method: "POST",
      body: JSON.stringify({
        applicationId: "123e4567-e89b-42d3-a456-426614174000",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.member.id).toBe("member-1");
  });
});

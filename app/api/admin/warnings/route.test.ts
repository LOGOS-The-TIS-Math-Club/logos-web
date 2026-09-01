import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listWarnings: vi.fn(),
  issueWarning: vi.fn(),
  resolveWarning: vi.fn(),
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
  listWarnings: mocks.listWarnings,
  issueManualWarning: mocks.issueWarning,
  resolveWarning: mocks.resolveWarning,
  WarningNotFoundError: class WarningNotFoundError extends Error {
    constructor() {
      super("Warning not found");
      this.name = "WarningNotFoundError";
    }
  },
}));

import { GET, PATCH, POST } from "./route";

describe("Admin Warnings API (/api/admin/warnings)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns warnings list", async () => {
    mocks.listWarnings.mockResolvedValue([
      { id: "warn-1", reason: "Absence warning" },
    ]);

    const req = new NextRequest("http://localhost/api/admin/warnings");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.warnings.length).toBe(1);
  });

  it("POST issues manual warning", async () => {
    mocks.issueWarning.mockResolvedValue({
      id: "warn-1",
      reason: "Absence warning",
      active: true,
    });

    const req = new NextRequest("http://localhost/api/admin/warnings", {
      method: "POST",
      body: JSON.stringify({
        memberId: "123e4567-e89b-42d3-a456-426614174000",
        reason: "Absence warning",
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.warning.id).toBe("warn-1");
  });

  it("PATCH resolves warning", async () => {
    mocks.resolveWarning.mockResolvedValue({
      id: "warn-1",
      active: false,
    });

    const req = new NextRequest("http://localhost/api/admin/warnings", {
      method: "PATCH",
      body: JSON.stringify({
        warningId: "123e4567-e89b-42d3-a456-426614174000",
      }),
    });

    const res = await PATCH(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.warning.active).toBe(false);
  });
});

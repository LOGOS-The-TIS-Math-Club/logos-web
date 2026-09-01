import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const mocks = vi.hoisted(() => ({
  submitApplication: vi.fn(),
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  withDatabase: vi.fn(),
}));

vi.mock("@/lib/applications/service.server", () => ({
  submitStudentApplication: mocks.submitApplication,
  DuplicateApplicationError: class DuplicateApplicationError extends Error {
    constructor(readonly applicationId: string) {
      super("Duplicate application");
      this.name = "DuplicateApplicationError";
    }
  },
  UnverifiedAffiliationError: class UnverifiedAffiliationError extends Error {
    constructor() {
      super("Unverified affiliation");
      this.name = "UnverifiedAffiliationError";
    }
  },
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  FORM_SUBMISSION_POLICY: {
    name: "form_submission",
    windowSeconds: 600,
    maxRequests: 60,
  },
}));

vi.mock("@/lib/db/client.server", () => ({
  withDatabase: mocks.withDatabase,
}));

import { POST } from "./route";
import {
  DuplicateApplicationError,
  UnverifiedAffiliationError,
} from "@/lib/applications/service.server";

describe("POST /api/applications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.withDatabase.mockImplementation(
      async (cb: (db: unknown) => unknown) => cb({}),
    );
  });

  it("returns 200 on successful submission", async () => {
    mocks.submitApplication.mockResolvedValue({
      id: "app-123",
      status: "submitted",
    });

    const request = new NextRequest("http://localhost/api/applications", {
      method: "POST",
      body: JSON.stringify({ preferredName: "Alex" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.applicationId).toBe("app-123");
  });

  it("returns 400 on Zod validation failure", async () => {
    mocks.submitApplication.mockRejectedValue(
      new ZodError([
        {
          code: "custom",
          message: "Too short",
          path: ["joinReason"],
        },
      ]),
    );

    const request = new NextRequest("http://localhost/api/applications", {
      method: "POST",
      body: JSON.stringify({ preferredName: "Alex" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.code).toBe("VALIDATION_FAILED");
  });

  it("returns 409 on duplicate active application", async () => {
    mocks.submitApplication.mockRejectedValue(
      new DuplicateApplicationError("existing-app-123"),
    );

    const request = new NextRequest("http://localhost/api/applications", {
      method: "POST",
      body: JSON.stringify({ preferredName: "Alex" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("DUPLICATE_APPLICATION");
    expect(body.applicationId).toBe("existing-app-123");
  });

  it("returns 403 on unverified affiliation", async () => {
    mocks.submitApplication.mockRejectedValue(new UnverifiedAffiliationError());

    const request = new NextRequest("http://localhost/api/applications", {
      method: "POST",
      body: JSON.stringify({ preferredName: "Alex" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.code).toBe("UNVERIFIED_AFFILIATION");
  });

  it("returns 429 when rate limited", async () => {
    mocks.checkRateLimit.mockResolvedValueOnce({
      success: false,
      retryAfterSeconds: 45,
    });

    const request = new NextRequest("http://localhost/api/applications", {
      method: "POST",
      body: JSON.stringify({ preferredName: "Alex" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("45");
  });
});

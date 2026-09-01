import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveIdentity: vi.fn(),
  requireCapability: vi.fn(),
  recordBusinessAudit: vi.fn().mockResolvedValue("audit-123"),
  withDatabase: vi.fn(),
}));

vi.mock("@/lib/auth/identity-access.server", () => ({
  resolveCurrentIdentity: mocks.resolveIdentity,
  requireCapability: mocks.requireCapability,
  AccessDeniedError: class AccessDeniedError extends Error {
    constructor(readonly code: string) {
      super("Access denied");
      this.name = "AccessDeniedError";
    }
  },
}));

vi.mock("@/lib/security/audit", () => ({
  recordBusinessAuditEvent: mocks.recordBusinessAudit,
}));

vi.mock("@/lib/db/client.server", () => ({
  withDatabase: mocks.withDatabase,
}));

import {
  DuplicateApplicationError,
  exportApplicationsCsvData,
  listApplicationsForReview,
  submitStudentApplication,
  UnverifiedAffiliationError,
  updateApplicationStatus,
} from "./service.server";

describe("Application Service (submitStudentApplication)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validPayload = {
    preferredName: "Jane Doe",
    grade: "Grade 11" as const,
    academicInterests: ["problem_solving", "geometry"],
    joinReason:
      "I am passionate about Olympiad math and want to explore difficult problems.",
    goals:
      "I want to learn number theory and help prepare mock contests for club members.",
    experience: null,
    attendanceConfirmation: "regular" as const,
    accuracyAcknowledged: true as const,
  };

  it("rejects submission when identity has unverified affiliation", async () => {
    mocks.resolveIdentity.mockResolvedValue({
      identityId: "id-123",
      email: "student@otherdomain.com",
      affiliationStatus: "pending_verification",
      active: true,
      accessLevel: "basic",
    });

    await expect(
      submitStudentApplication(validPayload, "corr-1"),
    ).rejects.toThrow(UnverifiedAffiliationError);
  });

  it("rejects duplicate submission when application already exists", async () => {
    mocks.resolveIdentity.mockResolvedValue({
      identityId: "id-123",
      email: "student@tokyois.com",
      affiliationStatus: "verified",
      active: true,
      accessLevel: "basic",
    });

    // Mock DB transaction returning an existing application
    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: "app-existing" }]),
          }),
        }),
      }),
    };

    mocks.withDatabase.mockImplementation(
      async (callback: (db: unknown) => unknown) => {
        return callback({
          transaction: async (txCb: (tx: unknown) => unknown) => txCb(mockTx),
        });
      },
    );

    await expect(
      submitStudentApplication(validPayload, "corr-2"),
    ).rejects.toThrow(DuplicateApplicationError);
  });

  it("successfully inserts application and writes audit journal on valid submission", async () => {
    mocks.resolveIdentity.mockResolvedValue({
      identityId: "id-123",
      email: "student@tokyois.com",
      affiliationStatus: "verified",
      active: true,
      accessLevel: "basic",
    });

    const mockInserted = {
      id: "app-new-123",
      status: "submitted",
      submittedAt: new Date("2026-09-01T12:00:00Z"),
    };

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockInserted]),
        }),
      }),
    };

    mocks.withDatabase.mockImplementation(
      async (callback: (db: unknown) => unknown) => {
        return callback({
          transaction: async (txCb: (tx: unknown) => unknown) => txCb(mockTx),
        });
      },
    );

    const result = await submitStudentApplication(validPayload, "corr-3");
    expect(result.id).toBe("app-new-123");
    expect(mocks.recordBusinessAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        action: "submit",
        category: "application",
        targetType: "student_application",
        targetId: "app-new-123",
        result: "success",
        metadata: { grade: "Grade 11" },
      }),
    );
  });
});

describe("Application Review & Status Updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires application:review capability to list applications", async () => {
    mocks.requireCapability.mockResolvedValue({
      identityId: "operator-id",
      accessLevel: "operator",
    });

    const mockApps = [
      {
        id: "app-1",
        preferredName: "Sam",
        grade: "Grade 10",
        status: "submitted",
      },
    ];

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockApps),
          }),
        }),
      }),
    };

    mocks.withDatabase.mockImplementation(
      async (cb: (db: unknown) => unknown) => cb(mockDb),
    );

    const result = await listApplicationsForReview("corr-4");
    expect(mocks.requireCapability).toHaveBeenCalledWith(
      "application:review",
      "corr-4",
    );
    expect(result).toEqual(mockApps);
  });

  it("updates application status and records audit event with previous/new status", async () => {
    mocks.requireCapability.mockResolvedValue({
      identityId: "operator-id",
      accessLevel: "operator",
    });

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi
              .fn()
              .mockResolvedValue([{ id: "app-1", status: "submitted" }]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: "app-1",
                status: "accepted",
                statusReason: "Strong profile",
              },
            ]),
          }),
        }),
      }),
    };

    mocks.withDatabase.mockImplementation(
      async (cb: (db: unknown) => unknown) => {
        return cb({
          transaction: async (txCb: (tx: unknown) => unknown) => txCb(mockTx),
        });
      },
    );

    const updated = await updateApplicationStatus(
      "app-1",
      { status: "accepted", statusReason: "Strong profile" },
      "corr-5",
    );

    expect(updated.status).toBe("accepted");
    expect(mocks.recordBusinessAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        action: "update_status",
        category: "application",
        targetId: "app-1",
        reasonCode: "accepted",
        beforeSummary: { status: "submitted" },
        afterSummary: { status: "accepted" },
      }),
    );
  });
});

describe("CSV Export Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires application:export capability and audits export action", async () => {
    mocks.requireCapability.mockResolvedValue({
      identityId: "operator-id",
      accessLevel: "operator",
    });

    const mockRows = [
      {
        id: "app-1",
        email: "student@tokyois.com",
        preferredName: "Jane Doe",
        grade: "Grade 11",
        academicInterests: ["algebra"],
        joinReason: "Math enthusiast",
        goals: "Learn competitive math",
        experience: null,
        attendanceConfirmation: "regular",
        status: "submitted",
        statusReason: null,
        submittedAt: new Date("2026-09-01T10:00:00Z"),
      },
    ];

    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue(mockRows),
          }),
        }),
      }),
    };

    mocks.withDatabase.mockImplementation(
      async (cb: (db: unknown) => unknown) => cb(mockDb),
    );

    const csv = await exportApplicationsCsvData("corr-6");
    expect(mocks.requireCapability).toHaveBeenCalledWith(
      "application:export",
      "corr-6",
    );
    expect(mocks.recordBusinessAudit).toHaveBeenCalledWith(
      mockDb,
      expect.objectContaining({
        action: "export",
        category: "application",
        targetType: "student_applications",
        targetId: "all",
      }),
    );
    expect(csv).toContain("Application ID");
    expect(csv).toContain('"Jane Doe"');
  });
});

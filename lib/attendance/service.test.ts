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
  createClubSession,
  getMemberAttendanceTotals,
  issueManualWarning,
  MemberNotActiveError,
  recordSessionAttendance,
  resolveWarning,
  SessionNotFoundError,
  submitExpectedAbsence,
} from "./service.server";

const validSessionId = "123e4567-e89b-42d3-a456-426614174001";
const validMemberId1 = "123e4567-e89b-42d3-a456-426614174002";
const validMemberId2 = "123e4567-e89b-42d3-a456-426614174003";
const validMissingSessionId = "123e4567-e89b-42d3-a456-426614174099";

describe("Attendance Service (createClubSession)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a club session with defaults and records an audit event", async () => {
    mocks.requireCapability.mockResolvedValue({
      identityId: "123e4567-e89b-42d3-a456-426614174000",
    });

    const mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: validSessionId,
              title: "LOGOS Weekly Meeting",
              sessionDate: "2026-09-04",
              startTime: "15:30",
              endTime: "16:30",
              location: "Room 101",
            },
          ]),
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

    const session = await createClubSession(
      {
        sessionDate: "2026-09-04",
        title: "LOGOS Weekly Meeting",
        startTime: "15:30",
        endTime: "16:30",
        location: "Room 101",
      },
      "corr-sess-1",
    );

    expect(session.id).toBe(validSessionId);
    expect(mocks.requireCapability).toHaveBeenCalledWith(
      "session:manage",
      "corr-sess-1",
    );
    expect(mocks.recordBusinessAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        category: "session",
        action: "create",
        targetId: validSessionId,
      }),
    );
  });
});

describe("Attendance Service (recordSessionAttendance)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upserts attendance ledger entries for members and records an audit event", async () => {
    mocks.requireCapability.mockResolvedValue({
      identityId: "123e4567-e89b-42d3-a456-426614174000",
    });

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: validSessionId,
                sessionDate: "2026-09-04",
              },
            ]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockResolvedValue([]),
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

    const result = await recordSessionAttendance(
      validSessionId,
      [
        {
          memberId: validMemberId1,
          status: "present",
        },
        {
          memberId: validMemberId2,
          status: "late",
          notes: "Arrived at 15:45",
        },
      ],
      "corr-att-1",
    );

    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
    expect(mocks.requireCapability).toHaveBeenCalledWith(
      "attendance:record",
      "corr-att-1",
    );
    expect(mocks.recordBusinessAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        category: "attendance",
        action: "record",
        targetId: validSessionId,
      }),
    );
  });

  it("throws SessionNotFoundError when session does not exist", async () => {
    mocks.requireCapability.mockResolvedValue({
      identityId: "123e4567-e89b-42d3-a456-426614174000",
    });

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
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
      recordSessionAttendance(validMissingSessionId, [], "corr-att-2"),
    ).rejects.toThrow(SessionNotFoundError);
  });
});

describe("Attendance Service (submitExpectedAbsence)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows active member to submit their own expected absence", async () => {
    mocks.resolveIdentity.mockResolvedValue({
      identityId: "123e4567-e89b-42d3-a456-426614174000",
      accessLevel: null,
      active: true,
      affiliationStatus: "verified",
    });

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: validMemberId1 }]),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "123e4567-e89b-42d3-a456-426614174010",
              memberId: validMemberId1,
              sessionDate: "2026-09-04",
              reason: "Doctor appointment",
              status: "submitted",
            },
          ]),
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

    const result = await submitExpectedAbsence(
      {
        sessionDate: "2026-09-04",
        reason: "Doctor appointment",
      },
      "corr-abs-1",
    );

    expect(result.id).toBe("123e4567-e89b-42d3-a456-426614174010");
    expect(mocks.recordBusinessAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        category: "absence",
        action: "submit",
        targetId: "123e4567-e89b-42d3-a456-426614174010",
      }),
    );
  });

  it("rejects absence submission if student is not an active member", async () => {
    mocks.resolveIdentity.mockResolvedValue({
      identityId: "123e4567-e89b-42d3-a456-426614174000",
      accessLevel: null,
      active: true,
      affiliationStatus: "verified",
    });

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
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
      submitExpectedAbsence(
        { sessionDate: "2026-09-04", reason: "Music rehearsal" },
        "corr-abs-2",
      ),
    ).rejects.toThrow(MemberNotActiveError);
  });
});

describe("Attendance Service (Manual Warnings)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("issues a manual warning and records audit event", async () => {
    mocks.requireCapability.mockResolvedValue({
      identityId: "123e4567-e89b-42d3-a456-426614174000",
    });

    const mockTx = {
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "123e4567-e89b-42d3-a456-426614174020",
              memberId: validMemberId1,
              reason: "Unnotified absence for 3 consecutive meetings",
              active: true,
            },
          ]),
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

    const warning = await issueManualWarning(
      {
        memberId: validMemberId1,
        reason: "Unnotified absence for 3 consecutive meetings",
      },
      "corr-warn-1",
    );

    expect(warning.id).toBe("123e4567-e89b-42d3-a456-426614174020");
    expect(mocks.requireCapability).toHaveBeenCalledWith(
      "warning:manage",
      "corr-warn-1",
    );
    expect(mocks.recordBusinessAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        category: "warning",
        action: "issue",
        targetId: "123e4567-e89b-42d3-a456-426614174020",
      }),
    );
  });
});

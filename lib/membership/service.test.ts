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
  activateMemberFromApplication,
  ApplicationNotAcceptedError,
  ApplicationNotFoundError,
  DuplicateActiveMemberError,
  updateMemberStatus,
} from "./service.server";

describe("Membership Service (activateMemberFromApplication)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validAppId = "123e4567-e89b-42d3-a456-426614174000";
  const validIdentityId = "123e4567-e89b-42d3-a456-426614174001";

  it("activates an accepted application and records an audit event", async () => {
    mocks.requireCapability.mockResolvedValue({
      identityId: "actor-operator-id",
      email: "operator@tokyois.com",
      accessLevel: "operator",
    });

    const mockTx = {
      select: vi
        .fn()
        // First select: application
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: validAppId,
                  identityId: validIdentityId,
                  status: "accepted",
                  preferredName: "Alice Chen",
                },
              ]),
            }),
          }),
        })
        // Second select: existing active member check
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      insert: vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([
            {
              id: "member-new-123",
              identityId: validIdentityId,
              applicationId: validAppId,
              status: "active",
              joinedAt: new Date(),
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

    const result = await activateMemberFromApplication(
      { applicationId: validAppId, reason: "Welcome to LOGOS" },
      "corr-act-1",
    );

    expect(result.id).toBe("member-new-123");
    expect(result.status).toBe("active");
    expect(mocks.requireCapability).toHaveBeenCalledWith(
      "membership:manage",
      "corr-act-1",
    );
    expect(mocks.recordBusinessAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        category: "membership",
        action: "activate",
        targetId: "member-new-123",
        result: "success",
      }),
    );
  });

  it("throws ApplicationNotFoundError when application is missing", async () => {
    mocks.requireCapability.mockResolvedValue({
      identityId: "actor-operator-id",
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
      activateMemberFromApplication({ applicationId: validAppId }, "corr-2"),
    ).rejects.toThrow(ApplicationNotFoundError);
  });

  it("throws ApplicationNotAcceptedError when application is not in accepted status", async () => {
    mocks.requireCapability.mockResolvedValue({
      identityId: "actor-operator-id",
    });

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: validAppId,
                identityId: validIdentityId,
                status: "submitted",
                preferredName: "Bob",
              },
            ]),
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
      activateMemberFromApplication({ applicationId: validAppId }, "corr-3"),
    ).rejects.toThrow(ApplicationNotAcceptedError);
  });

  it("throws DuplicateActiveMemberError if identity already has active membership", async () => {
    mocks.requireCapability.mockResolvedValue({
      identityId: "actor-operator-id",
    });

    const mockTx = {
      select: vi
        .fn()
        // First select: application (accepted)
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([
                {
                  id: validAppId,
                  identityId: validIdentityId,
                  status: "accepted",
                  preferredName: "Alice",
                },
              ]),
            }),
          }),
        })
        // Second select: existing active member found
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: "existing-member-id" }]),
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
      activateMemberFromApplication({ applicationId: validAppId }, "corr-4"),
    ).rejects.toThrow(DuplicateActiveMemberError);
  });
});

describe("Membership Service (updateMemberStatus)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates member status to former with leftAt timestamp and audits", async () => {
    mocks.requireCapability.mockResolvedValue({
      identityId: "operator-id",
    });

    const mockTx = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "member-1",
                status: "active",
                leftAt: null,
                statusReason: null,
              },
            ]),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: "member-1",
                status: "former",
                statusReason: "Graduated",
              },
            ]),
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

    const result = await updateMemberStatus(
      "member-1",
      { status: "former", reason: "Graduated" },
      "corr-update",
    );

    expect(result.status).toBe("former");
    expect(mocks.recordBusinessAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        category: "membership",
        action: "status_update",
        targetId: "member-1",
      }),
    );
  });
});

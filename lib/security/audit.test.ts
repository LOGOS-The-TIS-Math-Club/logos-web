import { describe, expect, test, vi } from "vitest";

import {
  BusinessAuditEventSchema,
  recordBusinessAuditEvent,
  recordSecurityAuditEvent,
  searchAuditJournal,
  SecurityAuditEventSchema,
} from "./audit";

describe("Append-Only Business and Security Audit Journals", () => {
  const VALID_UUID = "550e8400-e29b-41d4-a716-446655440000";

  describe("BusinessAuditEventSchema validation", () => {
    test("validates compliant business audit event input", () => {
      const valid = {
        actorId: VALID_UUID,
        actorType: "user" as const,
        actorRoleSnapshot: "member" as const,
        source: "action" as const,
        correlationId: VALID_UUID,
        category: "application",
        action: "submit",
        targetType: "application_form",
        targetId: "app-123",
        result: "success" as const,
        reasonCode: "SUBMITTED_ON_TIME",
        beforeSummary: { marker: "old" },
        afterSummary: { marker: "new" },
        metadata: { reason: "test" },
      };
      expect(() => BusinessAuditEventSchema.parse(valid)).not.toThrow();
    });

    test("rejects invalid actor_type or result", () => {
      const invalid = {
        actorType: "superadmin", // Invalid
        actorRoleSnapshot: "member",
        source: "action",
        correlationId: VALID_UUID,
        category: "application",
        action: "submit",
        targetType: "application_form",
        targetId: "app-123",
        result: "unknown", // Invalid
      };
      expect(() => BusinessAuditEventSchema.parse(invalid)).toThrow();
    });
  });

  describe("SecurityAuditEventSchema validation", () => {
    test("validates rate_limited result on security audit event", () => {
      const valid = {
        actorType: "anonymous" as const,
        actorRoleSnapshot: "none" as const,
        source: "web" as const,
        correlationId: VALID_UUID,
        category: "rate_limit",
        action: "request.reject",
        targetType: "ip_subject",
        targetId: "subj-hash-123",
        result: "rate_limited" as const,
        reasonCode: "LIMIT_EXCEEDED",
        metadata: { policy: "synthetic_test_policy" },
      };
      expect(() => SecurityAuditEventSchema.parse(valid)).not.toThrow();
    });
  });

  describe("Payload Allowlist Sanitization during Insertion", () => {
    test("sanitizes disallowed and sensitive keys from summaries and metadata", async () => {
      const mockReturning = vi.fn().mockResolvedValue([
        {
          id: VALID_UUID,
          correlationId: VALID_UUID,
        },
      ]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDb: any = { insert: mockInsert };

      await recordBusinessAuditEvent(mockDb, {
        actorType: "system",
        actorRoleSnapshot: "none",
        source: "internal",
        correlationId: VALID_UUID,
        category: "probe",
        action: "update",
        targetType: "probe",
        targetId: "1",
        result: "success",
        beforeSummary: {
          marker: "old_val",
          password: "must_not_persist",
          userEmail: "student@school.edu",
        },
        afterSummary: {
          marker: "new_val",
          secretKey: "secret_12345",
        },
        metadata: {
          reason: "valid_reason",
          token: "bearer_token",
        },
      });

      expect(mockInsert).toHaveBeenCalled();
      const passedValues = mockValues.mock.calls[0][0];

      // Disallowed and sensitive keys stripped
      expect(passedValues.beforeSummary).toEqual({ marker: "old_val" });
      expect(passedValues.afterSummary).toEqual({ marker: "new_val" });
      expect(passedValues.metadata).toEqual({ reason: "valid_reason" });
    });

    test("records security audit event with sanitized metadata", async () => {
      const mockReturning = vi.fn().mockResolvedValue([{ id: VALID_UUID }]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDb: any = { insert: mockInsert };

      await recordSecurityAuditEvent(mockDb, {
        actorType: "anonymous",
        actorRoleSnapshot: "none",
        source: "web",
        correlationId: VALID_UUID,
        category: "origin_check",
        action: "reject",
        targetType: "origin",
        targetId: "https://attacker.com",
        result: "denied",
        metadata: {
          reason: "untrusted_origin",
          password: "bad",
        },
      });

      const passedValues = mockValues.mock.calls[0][0];
      expect(passedValues.metadata).toEqual({ reason: "untrusted_origin" });
    });
  });

  describe("Bounded Hardened Search Interface", () => {
    test("rejects search when no filter is supplied", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDb: any = { execute: vi.fn() };

      await expect(
        searchAuditJournal({
          db: mockDb,
          journalType: "business",
        }),
      ).rejects.toThrow(/requires at least one narrowing filter/);
    });

    test("enforces maximum limit bounding of 100", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDb: any = {
        execute: vi.fn().mockResolvedValue({
          rows: [
            {
              id: VALID_UUID,
              recorded_at: "2026-08-31T20:30:00Z",
              tokyo_archive_date: "2026-09-01",
              schema_version: 1,
              actor_id: null,
              actor_type: "system",
              actor_role_snapshot: "none",
              source: "internal",
              correlation_id: VALID_UUID,
              category: "probe",
              action: "update",
              target_type: "probe",
              target_id: "1",
              result: "success",
              reason_code: null,
              before_summary: null,
              after_summary: null,
              metadata: null,
            },
          ],
        }),
      };

      const rows = await searchAuditJournal({
        db: mockDb,
        journalType: "business",
        limit: 500, // Exceeds 100 max
        correlationId: VALID_UUID,
      });

      expect(rows).toHaveLength(1);
      expect(rows[0].correlationId).toBe(VALID_UUID);
      expect(rows[0].tokyoArchiveDate).toBe("2026-09-01");
      expect(mockDb.execute).toHaveBeenCalled();
    });
  });
});

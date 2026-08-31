import { describe, expect, test, vi } from "vitest";

import {
  ClaimDurableOperationsSchema,
  claimDurableOperations,
  CompleteDurableOperationSchema,
  completeDurableOperation,
  EnqueueDurableOperationSchema,
  enqueueDurableOperation,
  FailDurableOperationSchema,
  failDurableOperation,
} from "./durable-operations";

describe("Durable Operations and Hardened Transitions", () => {
  const VALID_UUID_1 = "550e8400-e29b-41d4-a716-446655440001";
  const VALID_UUID_2 = "550e8400-e29b-41d4-a716-446655440002";
  const VALID_LEASE_TOKEN = "inert-lease-token";

  describe("Enqueue Schema Validation & Payload Allowlist", () => {
    test("validates and inserts durable operation with sanitized payload", async () => {
      const mockReturning = vi.fn().mockResolvedValue([
        {
          id: VALID_UUID_1,
          type: "email_notification",
          status: "pending",
        },
      ]);
      const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
      const mockInsert = vi.fn().mockReturnValue({ values: mockValues });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDb: any = { insert: mockInsert };

      await enqueueDurableOperation(mockDb, {
        correlationId: VALID_UUID_1,
        auditEventId: VALID_UUID_2,
        type: "email_notification",
        idempotencyKey: "idem-email-001",
        payload: {
          marker: "dispatch_email",
          secretKey: "must_not_leak",
          password: "bad",
        },
        maxAttempts: 3,
      });

      expect(mockInsert).toHaveBeenCalled();
      const passedValues = mockValues.mock.calls[0][0];

      expect(passedValues.type).toBe("email_notification");
      expect(passedValues.idempotencyKey).toBe("idem-email-001");
      expect(passedValues.payload).toEqual({ marker: "dispatch_email" });
    });

    test("rejects invalid UUID or empty type", () => {
      expect(() =>
        EnqueueDurableOperationSchema.parse({
          correlationId: "invalid-uuid",
          auditEventId: VALID_UUID_2,
          type: "test",
          idempotencyKey: "key-1",
          payload: {},
        }),
      ).toThrow();
    });
  });

  describe("Claim Durable Operations Interface & Bounds", () => {
    test("validates bounded claim input schema", () => {
      expect(() =>
        ClaimDurableOperationsSchema.parse({
          leaseSeconds: 0, // < 1
        }),
      ).toThrow();

      expect(() =>
        ClaimDurableOperationsSchema.parse({
          leaseSeconds: 3601, // > 3600
        }),
      ).toThrow();

      expect(() =>
        ClaimDurableOperationsSchema.parse({
          limit: 101, // > 100
        }),
      ).toThrow();

      expect(() =>
        ClaimDurableOperationsSchema.parse({
          workerId: "x".repeat(257), // > 256
        }),
      ).toThrow();

      const valid = ClaimDurableOperationsSchema.parse({
        workerId: "worker-1",
        leaseSeconds: 120,
        limit: 10,
      });
      expect(valid.leaseSeconds).toBe(120);
      expect(valid.limit).toBe(10);
    });

    test("claims pending operations via SQL function and maps returned rows", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDb: any = {
        execute: vi.fn().mockResolvedValue({
          rows: [
            {
              id: VALID_UUID_1,
              correlation_id: VALID_UUID_1,
              audit_event_id: VALID_UUID_2,
              type: "email_notification",
              idempotency_key: "idem-001",
              status: "processing",
              payload: { marker: "task_1" },
              attempt_count: 1,
              max_attempts: 5,
              lease_token: VALID_LEASE_TOKEN,
              lease_expires_at: "2026-08-31T20:35:00Z",
              created_at: "2026-08-31T20:30:00Z",
            },
          ],
        }),
      };

      const claimed = await claimDurableOperations({
        db: mockDb,
        workerId: "worker-sin1-01",
        leaseSeconds: 120,
        limit: 10,
      });

      expect(claimed).toHaveLength(1);
      expect(claimed[0].id).toBe(VALID_UUID_1);
      expect(claimed[0].leaseToken).toBe(VALID_LEASE_TOKEN);
      expect(claimed[0].status).toBe("processing");
      expect(mockDb.execute).toHaveBeenCalled();
    });
  });

  describe("Complete Durable Operation Interface & Bounds", () => {
    test("validates bounded complete input schema", () => {
      expect(() =>
        CompleteDurableOperationSchema.parse({
          id: "not-a-uuid",
          leaseToken: VALID_LEASE_TOKEN,
          status: "succeeded",
        }),
      ).toThrow();

      expect(() =>
        CompleteDurableOperationSchema.parse({
          id: VALID_UUID_1,
          leaseToken: "", // empty
          status: "succeeded",
        }),
      ).toThrow();

      expect(() =>
        CompleteDurableOperationSchema.parse({
          id: VALID_UUID_1,
          leaseToken: VALID_LEASE_TOKEN,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: "pending" as any, // invalid status
        }),
      ).toThrow();

      expect(() =>
        CompleteDurableOperationSchema.parse({
          id: VALID_UUID_1,
          leaseToken: VALID_LEASE_TOKEN,
          status: "succeeded",
          providerReference: "x".repeat(257),
        }),
      ).toThrow();
    });

    test("calls completion function with matching lease token", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDb: any = {
        execute: vi.fn().mockResolvedValue({
          rows: [{ result: true }],
        }),
      };

      const success = await completeDurableOperation({
        db: mockDb,
        id: VALID_UUID_1,
        leaseToken: VALID_LEASE_TOKEN,
        status: "succeeded",
        providerReference: "provider-ref-999",
      });

      expect(success).toBe(true);
      expect(mockDb.execute).toHaveBeenCalled();
    });

    test("throws on invalid completion status", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDb: any = { execute: vi.fn() };

      await expect(
        completeDurableOperation({
          db: mockDb,
          id: VALID_UUID_1,
          leaseToken: VALID_LEASE_TOKEN,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: "pending" as any,
        }),
      ).rejects.toThrow();
    });
  });

  describe("Fail Durable Operation Interface & Bounds", () => {
    test("validates bounded fail input schema", () => {
      expect(() =>
        FailDurableOperationSchema.parse({
          id: VALID_UUID_1,
          leaseToken: VALID_LEASE_TOKEN,
          retryDelaySeconds: 0, // < 1
        }),
      ).toThrow();

      expect(() =>
        FailDurableOperationSchema.parse({
          id: VALID_UUID_1,
          leaseToken: VALID_LEASE_TOKEN,
          retryDelaySeconds: 604801, // > 7 days
        }),
      ).toThrow();

      expect(() =>
        FailDurableOperationSchema.parse({
          id: VALID_UUID_1,
          leaseToken: VALID_LEASE_TOKEN,
          failureCode: "x".repeat(65), // > 64
        }),
      ).toThrow();
    });

    test("calls fail function for retry or terminal failure", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDb: any = {
        execute: vi.fn().mockResolvedValue({
          rows: [{ result: true }],
        }),
      };

      const success = await failDurableOperation({
        db: mockDb,
        id: VALID_UUID_1,
        leaseToken: VALID_LEASE_TOKEN,
        failureCode: "PROVIDER_TIMEOUT",
        lastError: "Connection timed out to provider",
        retryDelaySeconds: 45,
      });

      expect(success).toBe(true);
      expect(mockDb.execute).toHaveBeenCalled();
    });
  });
});

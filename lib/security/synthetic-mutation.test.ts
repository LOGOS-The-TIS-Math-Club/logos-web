import { describe, expect, test, vi } from "vitest";

import {
  executeSyntheticTechnicalMutation,
  SyntheticMutationInputSchema,
} from "./synthetic-mutation";

describe("Server-Only Composite Synthetic Mutation Helper", () => {
  const VALID_UUID_1 = "550e8400-e29b-41d4-a716-446655440001";
  const VALID_UUID_2 = "550e8400-e29b-41d4-a716-446655440002";
  const VALID_UUID_3 = "550e8400-e29b-41d4-a716-446655440003";

  describe("Input Schema Validation", () => {
    test("validates compliant synthetic mutation inputs", () => {
      const valid = {
        marker: "logos-phase-03-marker",
        previousMarker: "logos-phase-02-marker",
        actorType: "system" as const,
        actorRoleSnapshot: "none" as const,
        correlationId: VALID_UUID_1,
        idempotencyKey: "idem-001",
        reason: "unit_test_mutation",
      };

      expect(() => SyntheticMutationInputSchema.parse(valid)).not.toThrow();
    });

    test("rejects missing or empty marker or idempotencyKey", () => {
      expect(() =>
        SyntheticMutationInputSchema.parse({
          marker: "",
          correlationId: VALID_UUID_1,
          idempotencyKey: "idem-001",
        }),
      ).toThrow();

      expect(() =>
        SyntheticMutationInputSchema.parse({
          marker: "valid-marker",
          correlationId: VALID_UUID_1,
          idempotencyKey: "",
        }),
      ).toThrow();
    });
  });

  describe("Transaction Execution & Atomic Steps", () => {
    test("executes probe mutation, audit event insertion, and durable operation in single transaction", async () => {
      const mockAudit = { id: VALID_UUID_2, correlationId: VALID_UUID_1 };
      const mockOp = { id: VALID_UUID_3, correlationId: VALID_UUID_1 };

      let insertCallCount = 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockTx: any = {
        insert: vi.fn(() => {
          insertCallCount++;
          const currentCall = insertCallCount;
          return {
            values: vi.fn(() => {
              return {
                onConflictDoUpdate: vi.fn().mockResolvedValue([{ id: 1 }]),
                returning: vi
                  .fn()
                  .mockResolvedValue(
                    currentCall === 2 ? [mockAudit] : [mockOp],
                  ),
              };
            }),
          };
        }),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDb: any = {
        transaction: vi.fn(async (callback) => {
          return await callback(mockTx);
        }),
      };

      const result = await executeSyntheticTechnicalMutation(
        {
          marker: "updated-marker",
          previousMarker: "old-marker",
          correlationId: VALID_UUID_1,
          idempotencyKey: "idem-001",
          reason: "test-run",
        },
        mockDb,
      );

      expect(result).toEqual({
        success: true,
        correlationId: VALID_UUID_1,
        auditEventId: expect.any(String),
        operationId: VALID_UUID_3,
      });

      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.insert).toHaveBeenCalledTimes(3); // Probe + Audit + Operation
    });

    test("propagates error and triggers rollback if any step fails in transaction", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockTx: any = {
        insert: vi.fn(() => {
          throw new Error("Simulated constraint violation");
        }),
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mockDb: any = {
        transaction: vi.fn(async (callback) => {
          return await callback(mockTx);
        }),
      };

      await expect(
        executeSyntheticTechnicalMutation(
          {
            marker: "updated-marker",
            correlationId: VALID_UUID_1,
            idempotencyKey: "idem-001",
          },
          mockDb,
        ),
      ).rejects.toThrow(/Simulated constraint violation/);
    });
  });
});

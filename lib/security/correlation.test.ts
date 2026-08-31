import { describe, expect, test } from "vitest";

import {
  CORRELATION_HEADER_NAME,
  CORRELATION_HEADER_NAME_CANONICAL,
  createCorrelationContext,
  generateCorrelationId,
  getCorrelationId,
  isValidCorrelationId,
  resolveServerCorrelationId,
  setCorrelationHeader,
} from "./correlation";

describe("Correlation Engine", () => {
  const UUID_V4_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  describe("isValidCorrelationId", () => {
    test("accepts valid RFC 4122 UUIDv4 strings", () => {
      const validUuids = [
        "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
        "550e8400-e29b-41d4-a716-446655440000",
        "00000000-0000-4000-8000-000000000000",
        "FFFFFFFF-FFFF-4FFF-BFFF-FFFFFFFFFFFF",
      ];
      for (const uuid of validUuids) {
        expect(isValidCorrelationId(uuid)).toBe(true);
      }
    });

    test("rejects invalid UUID formats, UUIDv1, and malformed strings", () => {
      const invalidValues: unknown[] = [
        null,
        undefined,
        12345,
        {},
        [],
        "",
        "not-a-uuid",
        "550e8400-e29b-11d4-a716-446655440000", // UUIDv1 (version digit is 1)
        "550e8400-e29b-51d4-a716-446655440000", // UUIDv5 (version digit is 5)
        "550e8400-e29b-41d4-0716-446655440000", // Invalid variant (0 instead of 8, 9, a, b)
        "550e8400e29b41d4a716446655440000", // Missing hyphens
        "550e8400-e29b-41d4-a716-446655440000-extra",
        " 550e8400-e29b-41d4-a716-446655440000 ",
      ];
      for (const val of invalidValues) {
        expect(isValidCorrelationId(val)).toBe(false);
      }
    });
  });

  describe("generateCorrelationId", () => {
    test("generates valid UUIDv4 strings using crypto.randomUUID", () => {
      const id = generateCorrelationId();
      expect(typeof id).toBe("string");
      expect(UUID_V4_PATTERN.test(id)).toBe(true);
      expect(isValidCorrelationId(id)).toBe(true);
    });

    test("generates distinct IDs on consecutive calls", () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateCorrelationId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe("resolveServerCorrelationId", () => {
    test("generates a new server UUIDv4 when client correlation ID is omitted", () => {
      const id = resolveServerCorrelationId();
      expect(isValidCorrelationId(id)).toBe(true);
    });

    test("ignores client-supplied correlation ID even if it is a valid UUIDv4", () => {
      const clientSuppliedId = "550e8400-e29b-41d4-a716-446655440000";
      const resolvedId = resolveServerCorrelationId(clientSuppliedId);

      expect(resolvedId).not.toBe(clientSuppliedId);
      expect(isValidCorrelationId(resolvedId)).toBe(true);
    });

    test("ignores client-supplied malformed strings or attack payloads", () => {
      const attackPayloads = [
        "<script>alert(1)</script>",
        "../../etc/passwd",
        "admin'; DROP TABLE logs; --",
        "non-uuid-string",
        "",
      ];

      for (const payload of attackPayloads) {
        const resolvedId = resolveServerCorrelationId(payload);
        expect(resolvedId).not.toBe(payload);
        expect(isValidCorrelationId(resolvedId)).toBe(true);
      }
    });
  });

  describe("createCorrelationContext", () => {
    test("creates context with server-generated UUIDv4 and current timestamp", () => {
      const before = Date.now();
      const context = createCorrelationContext();
      const after = Date.now();

      expect(isValidCorrelationId(context.correlationId)).toBe(true);
      expect(context.createdAt).toBeGreaterThanOrEqual(before);
      expect(context.createdAt).toBeLessThanOrEqual(after);
    });

    test("ignores client-supplied correlation ID in createCorrelationContext", () => {
      const clientSuppliedId = "11111111-2222-4333-8444-555555555555";
      const context = createCorrelationContext(clientSuppliedId);

      expect(context.correlationId).not.toBe(clientSuppliedId);
      expect(isValidCorrelationId(context.correlationId)).toBe(true);
    });
  });

  describe("setCorrelationHeader", () => {
    test("sets header on standard Headers instance", () => {
      const headers = new Headers();
      const correlationId = generateCorrelationId();

      setCorrelationHeader(headers, correlationId);
      expect(headers.get(CORRELATION_HEADER_NAME)).toBe(correlationId);
      expect(headers.get(CORRELATION_HEADER_NAME_CANONICAL)).toBe(
        correlationId,
      );
    });

    test("sets header on plain Record<string, string>", () => {
      const headersRecord: Record<string, string> = {};
      const correlationId = generateCorrelationId();

      setCorrelationHeader(headersRecord, correlationId);
      expect(headersRecord[CORRELATION_HEADER_NAME_CANONICAL]).toBe(
        correlationId,
      );
    });
  });

  describe("getCorrelationId", () => {
    test("extracts valid UUIDv4 from Headers instance", () => {
      const headers = new Headers();
      const validId = generateCorrelationId();
      headers.set(CORRELATION_HEADER_NAME, validId);

      expect(getCorrelationId(headers)).toBe(validId);
    });

    test("extracts valid UUIDv4 from plain Record", () => {
      const validId = generateCorrelationId();
      const record = { [CORRELATION_HEADER_NAME_CANONICAL]: validId };

      expect(getCorrelationId(record)).toBe(validId);
    });

    test("returns null if header is missing or not a valid UUIDv4", () => {
      expect(getCorrelationId(new Headers())).toBeNull();
      expect(
        getCorrelationId({ [CORRELATION_HEADER_NAME]: "invalid-uuid" }),
      ).toBeNull();
      expect(getCorrelationId({ [CORRELATION_HEADER_NAME]: "" })).toBeNull();
    });
  });
});

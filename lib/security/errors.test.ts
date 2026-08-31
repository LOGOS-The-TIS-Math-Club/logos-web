import { describe, expect, test } from "vitest";

import {
  ALLOWLISTED_PUBLIC_MESSAGES,
  createSafeErrorEnvelope,
  createSafeErrorResponse,
  DEFAULT_PUBLIC_ERROR_MESSAGES,
  type PublicErrorCode,
} from "./errors";

describe("Safe Structured Error Envelopes", () => {
  const VALID_CORRELATION_ID = "550e8400-e29b-41d4-a716-446655440000";

  test("contains standard public error codes and safe messages", () => {
    const codes: PublicErrorCode[] = [
      "VALIDATION_FAILED",
      "FORBIDDEN_ORIGIN",
      "RATE_LIMITED",
      "CONFLICT",
      "INTERNAL_SERVER_ERROR",
    ];

    for (const code of codes) {
      expect(DEFAULT_PUBLIC_ERROR_MESSAGES[code]).toBeTruthy();
      expect(
        ALLOWLISTED_PUBLIC_MESSAGES.has(DEFAULT_PUBLIC_ERROR_MESSAGES[code]),
      ).toBe(true);
    }
  });

  test("creates safe error envelope with default message", () => {
    const envelope = createSafeErrorEnvelope(
      "FORBIDDEN_ORIGIN",
      VALID_CORRELATION_ID,
    );

    expect(envelope).toEqual({
      error: {
        code: "FORBIDDEN_ORIGIN",
        message: "Request origin or anti-CSRF verification failed.",
        correlationId: VALID_CORRELATION_ID,
      },
    });
  });

  test("withholds unallowlisted custom messages to prevent information leakage", () => {
    const leakyMessage =
      "Error in SQL query: SELECT * FROM logos.users WHERE password = '123'";

    const envelope = createSafeErrorEnvelope(
      "INTERNAL_SERVER_ERROR",
      VALID_CORRELATION_ID,
      leakyMessage,
    );

    expect(envelope.error.message).toBe(
      DEFAULT_PUBLIC_ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    );
    expect(envelope.error.message).not.toContain("SQL");
    expect(envelope.error.message).not.toContain("password");
  });

  test("accepts allowlisted message override", () => {
    const envelope = createSafeErrorEnvelope(
      "RATE_LIMITED",
      VALID_CORRELATION_ID,
      "Request rate limit exceeded. Please try again later.",
    );

    expect(envelope.error.message).toBe(
      "Request rate limit exceeded. Please try again later.",
    );
  });

  test("creates NextResponse with correct status, no-store cache control, and correlation header", async () => {
    const response = createSafeErrorResponse(
      "RATE_LIMITED",
      429,
      VALID_CORRELATION_ID,
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Correlation-ID")).toBe(VALID_CORRELATION_ID);

    const body = await response.json();
    expect(body).toEqual({
      error: {
        code: "RATE_LIMITED",
        message: "Request rate limit exceeded. Please try again later.",
        correlationId: VALID_CORRELATION_ID,
      },
    });
  });
});

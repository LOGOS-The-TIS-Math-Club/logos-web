import { NextResponse } from "next/server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "./correlation";

/**
 * Standard public error codes defined for LOGOS Web Phase 03.
 * These codes are safe to return to clients and do not leak internal system details.
 */
export type PublicErrorCode =
  | "VALIDATION_FAILED"
  | "FORBIDDEN_ORIGIN"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR";

/**
 * Stable, typed public error response body format.
 * Guarantees consistent error envelopes across all endpoints and middlewares.
 */
export interface PublicErrorEnvelope {
  readonly error: {
    readonly code: PublicErrorCode;
    readonly message: string;
    readonly correlationId: string;
  };
}

/**
 * Standard, safe human-readable messages associated with public error codes.
 */
export const DEFAULT_PUBLIC_ERROR_MESSAGES: Readonly<
  Record<PublicErrorCode, string>
> = {
  FORBIDDEN_ORIGIN: "Request origin or anti-CSRF verification failed.",
  VALIDATION_FAILED: "Invalid request payload or parameters.",
  RATE_LIMITED: "Request rate limit exceeded. Please try again later.",
  CONFLICT: "A conflict occurred with the current state of the resource.",
  INTERNAL_SERVER_ERROR:
    "An unexpected error occurred. Please reference the correlation ID if reporting this issue.",
};

/**
 * Allowlist of fixed public error messages that are safe to expose to clients.
 * Invariant: Arbitrary raw custom messages are never reflected to clients to prevent
 * accidental information leakage (stack traces, SQL errors, connection strings, secrets).
 */
export const ALLOWLISTED_PUBLIC_MESSAGES: ReadonlySet<string> = new Set(
  Object.values(DEFAULT_PUBLIC_ERROR_MESSAGES),
);

/**
 * Builds a structured, safe public error payload.
 *
 * Invariant: Never contains raw tokens, cookies, stack traces, database details, or secrets.
 * Only predefined allowlisted messages are permitted; unallowlisted custom messages are
 * safely replaced with the default message for the given error code.
 *
 * @param code - Standard public error code.
 * @param correlationId - Server-generated correlation ID.
 * @param customMessage - Optional message override (must be in ALLOWLISTED_PUBLIC_MESSAGES).
 */
export function createSafeErrorEnvelope(
  code: PublicErrorCode,
  correlationId: string,
  customMessage?: string,
): PublicErrorEnvelope {
  let message = DEFAULT_PUBLIC_ERROR_MESSAGES[code];

  if (typeof customMessage === "string") {
    const trimmed = customMessage.trim();
    if (ALLOWLISTED_PUBLIC_MESSAGES.has(trimmed)) {
      message = trimmed;
    }
  }

  return {
    error: {
      code,
      message,
      correlationId,
    },
  };
}

/**
 * Creates a NextResponse containing the safe public error envelope, status code,
 * correlation ID header, Cache-Control: no-store, and optional security headers.
 *
 * @param code - Standard public error code.
 * @param status - HTTP status code (e.g. 403, 429, 500).
 * @param correlationId - Server-generated correlation ID.
 * @param customMessage - Optional safe message override.
 * @param extraHeaders - Optional security headers to preserve on rejection.
 */
export function createSafeErrorResponse(
  code: PublicErrorCode,
  status: number,
  correlationId: string,
  customMessage?: string,
  extraHeaders?: Headers | Record<string, string>,
): NextResponse<PublicErrorEnvelope> {
  const payload = createSafeErrorEnvelope(code, correlationId, customMessage);
  const responseHeaders = new Headers(extraHeaders);

  responseHeaders.set(CORRELATION_HEADER_NAME_CANONICAL, correlationId);
  responseHeaders.set("Cache-Control", "no-store");
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");

  return NextResponse.json(payload, {
    status,
    headers: responseHeaders,
  });
}

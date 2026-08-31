import { randomUUID } from "node:crypto";

/**
 * Standard HTTP header names for correlation ID propagation.
 */
export const CORRELATION_HEADER_NAME = "x-correlation-id" as const;
export const CORRELATION_HEADER_NAME_CANONICAL = "X-Correlation-ID" as const;

/**
 * RFC 4122 v4 UUID regular expression for format validation.
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Structured server-side correlation context.
 */
export interface CorrelationContext {
  readonly correlationId: string;
  readonly createdAt: number;
}

/**
 * Validates whether a value is a valid RFC 4122 UUIDv4 string.
 *
 * @param value - Untrusted value to validate.
 * @returns Type predicate indicating whether value is a valid UUIDv4 string.
 */
export function isValidCorrelationId(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_REGEX.test(value);
}

/**
 * Generates a cryptographically secure server-side correlation ID (UUIDv4).
 * Always generated using `crypto.randomUUID()`.
 */
export function generateCorrelationId(): string {
  return randomUUID();
}

/**
 * Resolves a server-side correlation ID for an incoming request or operation.
 *
 * In accordance with Phase 03 security invariants:
 * Any client-supplied correlation ID is untrusted and intentionally ignored
 * to prevent identifier spoofing, header injection, and tracing correlation collisions.
 * A new UUIDv4 is always generated server-side.
 *
 * @param _untrustedClientCorrelationId - Ignored untrusted client input.
 * @returns A freshly generated server-side UUIDv4 correlation ID.
 */
export function resolveServerCorrelationId(
  _untrustedClientCorrelationId?: unknown,
): string {
  void _untrustedClientCorrelationId;
  return randomUUID();
}

/**
 * Creates a server-side correlation context.
 *
 * In accordance with Phase 03 security invariants:
 * Any client-supplied correlation ID is untrusted and intentionally ignored.
 * A new UUIDv4 is always generated server-side.
 *
 * @param _untrustedClientCorrelationId - Ignored untrusted client input.
 * @returns Structured correlation context with fresh UUIDv4 and creation timestamp.
 */
export function createCorrelationContext(
  _untrustedClientCorrelationId?: unknown,
): CorrelationContext {
  void _untrustedClientCorrelationId;
  return {
    correlationId: randomUUID(),
    createdAt: Date.now(),
  };
}

/**
 * Injects the correlation ID header on a standard Headers object or a plain headers record.
 *
 * @param headers - Target Headers instance or plain headers record.
 * @param correlationId - Server-generated correlation ID to set.
 */
export function setCorrelationHeader(
  headers: Headers | Record<string, string>,
  correlationId: string,
): void {
  if (headers instanceof Headers) {
    headers.set(CORRELATION_HEADER_NAME_CANONICAL, correlationId);
  } else {
    headers[CORRELATION_HEADER_NAME_CANONICAL] = correlationId;
  }
}

/**
 * Extracts the correlation ID from a Headers instance or a plain record,
 * returning the value only if it is a valid UUIDv4.
 *
 * @param headers - Target Headers instance or plain headers record.
 * @returns Valid correlation ID or null if missing/invalid.
 */
export function getCorrelationId(
  headers: Headers | Record<string, string | string[] | undefined>,
): string | null {
  let candidate: string | null = null;
  if (headers instanceof Headers) {
    candidate =
      headers.get(CORRELATION_HEADER_NAME) ??
      headers.get(CORRELATION_HEADER_NAME_CANONICAL);
  } else {
    const val =
      headers[CORRELATION_HEADER_NAME] ??
      headers[CORRELATION_HEADER_NAME_CANONICAL];
    if (typeof val === "string") {
      candidate = val;
    } else if (
      Array.isArray(val) &&
      val.length > 0 &&
      typeof val[0] === "string"
    ) {
      candidate = val[0];
    }
  }
  return isValidCorrelationId(candidate) ? candidate : null;
}

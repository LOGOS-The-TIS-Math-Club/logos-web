import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Standard HTTP methods classified as safe and non-mutating (RFC 7231 / RFC 9110).
 */
export const SAFE_HTTP_METHODS = ["GET", "HEAD", "OPTIONS"] as const;
export type SafeHttpMethod = (typeof SAFE_HTTP_METHODS)[number];

/**
 * Mutating HTTP methods requiring origin and CSRF validation for browser requests.
 */
export const MUTATING_HTTP_METHODS = [
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
] as const;
export type MutatingHttpMethod = (typeof MUTATING_HTTP_METHODS)[number];

/**
 * CSRF Cookie configuration name.
 * Uses __Host- prefix for maximum cookie security:
 * - Must be sent over HTTPS (or secure context)
 * - Must not have a Domain attribute (origin bound)
 * - Path must be /
 */
export const CSRF_COOKIE_NAME = "__Host-logos_csrf" as const;

/**
 * CSRF request header name for client header echo.
 */
export const CSRF_HEADER_NAME = "x-csrf-token" as const;
export const CSRF_HEADER_NAME_CANONICAL = "X-CSRF-Token" as const;

/**
 * Minimum secret length in bytes (256 bits).
 */
export const MIN_CSRF_SECRET_BYTES = 32;

/**
 * Byte length of the raw cryptographically random token part.
 */
export const CSRF_RAW_TOKEN_BYTES = 32;

/**
 * Supported CSRF token versions.
 */
export const CSRF_TOKEN_VERSION = "v1" as const;

/**
 * Default token validity lifetime in milliseconds (1 hour).
 */
export const DEFAULT_CSRF_MAX_AGE_MS = 60 * 60 * 1000;

/**
 * Maximum allowed character length for security-sensitive headers and tokens (Origin, Referer, CSRF tokens).
 * Bounds memory and CPU consumption against denial of service or regex/string attacks.
 */
export const MAX_SECURITY_INPUT_LENGTH = 1024;

/**
 * Stable, typed failure codes for origin and CSRF validation.
 * Crucial invariant: never contains raw tokens, cookies, or secrets.
 */
export type SecurityFailureCode =
  | "ORIGIN_MISSING"
  | "ORIGIN_MALFORMED"
  | "ORIGIN_HAS_PATH"
  | "ORIGIN_HAS_QUERY"
  | "ORIGIN_HAS_FRAGMENT"
  | "ORIGIN_HAS_USERINFO"
  | "ORIGIN_UNTRUSTED"
  | "METHOD_INVALID"
  | "CSRF_SECRET_INSUFFICIENT"
  | "CSRF_COOKIE_MISSING"
  | "CSRF_HEADER_MISSING"
  | "CSRF_TOKEN_MISMATCH"
  | "CSRF_TOKEN_MALFORMED"
  | "CSRF_VERSION_UNSUPPORTED"
  | "CSRF_TOKEN_EXPIRED"
  | "CSRF_TIMESTAMP_FUTURE"
  | "CSRF_SIGNATURE_INVALID";

/**
 * Result of security validation checks.
 */
export type SecurityValidationResult =
  | { readonly success: true }
  | {
      readonly success: false;
      readonly code: SecurityFailureCode;
      readonly reason: string;
    };

/**
 * Checks whether an HTTP method is classified as safe/non-mutating.
 *
 * @param method - HTTP method string to test (case-insensitive).
 */
export function isSafeHttpMethod(method: string): boolean {
  const upper = method.trim().toUpperCase();
  return (SAFE_HTTP_METHODS as readonly string[]).includes(upper);
}

/**
 * Checks whether an HTTP method is a standard mutating method.
 *
 * @param method - HTTP method string to test (case-insensitive).
 */
export function isMutatingHttpMethod(method: string): boolean {
  const upper = method.trim().toUpperCase();
  return (MUTATING_HTTP_METHODS as readonly string[]).includes(upper);
}

/**
 * Validates whether an allowlist origin string is a well-formed canonical origin:
 * must contain scheme + authority only, no path, query, hash, or userinfo.
 */
function isCanonicalOrigin(originStr: string): boolean {
  try {
    const url = new URL(originStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    if (url.username !== "" || url.password !== "") {
      return false;
    }
    if (url.pathname !== "" && url.pathname !== "/") {
      return false;
    }
    if (url.search !== "" || url.hash !== "") {
      return false;
    }
    // Must match its own .origin
    return url.origin === originStr;
  } catch {
    return false;
  }
}

/**
 * Safely and boundedly extracts the canonical origin (scheme + authority) from a Referer header URL.
 *
 * Enforces:
 * - Maximum character length <= MAX_SECURITY_INPUT_LENGTH (1024 bytes).
 * - Non-empty and not 'null'.
 * - Must be a valid URL with http: or https: scheme only.
 * - Must NOT contain userinfo / credentials.
 * - Extracts parsedUrl.origin (stripping path, query, and fragment cleanly and safely).
 * - Never derives trust from Host or client forwarded headers.
 *
 * @param referer - Raw Referer header value.
 */
export function extractOriginFromReferer(referer: string | null | undefined):
  | { readonly success: true; readonly origin: string }
  | {
      readonly success: false;
      readonly code: SecurityFailureCode;
      readonly reason: string;
    } {
  if (referer === null || referer === undefined) {
    return {
      success: false,
      code: "ORIGIN_MISSING",
      reason: "Referer header is absent",
    };
  }

  if (referer.length > MAX_SECURITY_INPUT_LENGTH) {
    return {
      success: false,
      code: "ORIGIN_MALFORMED",
      reason: "Referer header exceeds maximum allowed length",
    };
  }

  const trimmed = referer.trim();
  if (trimmed === "" || trimmed === "null") {
    return {
      success: false,
      code: "ORIGIN_MISSING",
      reason: "Referer header cannot be empty or 'null'",
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return {
      success: false,
      code: "ORIGIN_MALFORMED",
      reason: "Referer header is not a valid URL",
    };
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    return {
      success: false,
      code: "ORIGIN_MALFORMED",
      reason: "Referer protocol must be HTTP or HTTPS",
    };
  }

  if (parsedUrl.username !== "" || parsedUrl.password !== "") {
    return {
      success: false,
      code: "ORIGIN_HAS_USERINFO",
      reason: "Referer header must not contain userinfo",
    };
  }

  return {
    success: true,
    origin: parsedUrl.origin,
  };
}

/**
 * Configuration options for origin verification.
 */
export interface OriginVerifierOptions {
  /**
   * Primary application URL (e.g. from process.env.APP_URL).
   */
  readonly appUrl?: string;
  /**
   * Explicit list of additional trusted origins (e.g. from TRUSTED_ORIGINS).
   * Wildcards are NOT permitted.
   */
  readonly trustedOrigins?: readonly string[];
}

/**
 * Origin verification engine.
 *
 * Enforces:
 * - Exact, explicit origin allowlist after strict URL parsing.
 * - Rejection of missing, null, malformed, path-bearing, query-bearing, fragment-bearing,
 *   userinfo-bearing, and cross-origin origins.
 * - NEVER reads Host, X-Forwarded-Host, or client headers to derive trusted origins.
 * - Never allows wildcard suffix matching (e.g. *.vercel.app).
 */
export class OriginVerifier {
  private readonly allowedOrigins: ReadonlySet<string>;
  private readonly configError: boolean;

  constructor(options: OriginVerifierOptions) {
    const origins = new Set<string>();
    let configError = false;

    if (options.appUrl !== undefined) {
      const trimmedAppUrl = options.appUrl.trim();
      if (trimmedAppUrl !== "") {
        try {
          const parsed = new URL(trimmedAppUrl);
          if (
            (parsed.protocol === "http:" || parsed.protocol === "https:") &&
            parsed.username === "" &&
            parsed.password === "" &&
            (parsed.pathname === "" || parsed.pathname === "/") &&
            parsed.search === "" &&
            parsed.hash === "" &&
            parsed.origin === trimmedAppUrl.replace(/\/$/, "")
          ) {
            origins.add(parsed.origin);
          } else {
            configError = true;
          }
        } catch {
          configError = true;
        }
      }
    }

    if (options.trustedOrigins !== undefined) {
      for (const raw of options.trustedOrigins) {
        const trimmed = raw.trim();
        if (trimmed === "") {
          configError = true;
          continue;
        }
        if (isCanonicalOrigin(trimmed)) {
          origins.add(trimmed);
        } else {
          configError = true;
        }
      }
    }

    this.allowedOrigins = origins;
    this.configError = configError;
  }

  /**
   * Returns whether any configuration error was detected during initialization.
   */
  public hasConfigurationError(): boolean {
    return this.configError;
  }

  /**
   * Returns the set of explicitly allowed canonical origins.
   */
  public getAllowedOrigins(): ReadonlySet<string> {
    return this.allowedOrigins;
  }

  /**
   * Validates an incoming request origin string for a given HTTP method.
   *
   * @param rawOrigin - Origin header value.
   * @param method - HTTP request method.
   */
  public verifyOrigin(
    rawOrigin: string | null | undefined,
    method: string,
  ): SecurityValidationResult {
    // Safe, idempotent methods (GET, HEAD, OPTIONS) do not require origin validation
    if (isSafeHttpMethod(method)) {
      return { success: true };
    }

    // Fail-safe: If configuration is invalid or no trusted origins are configured, reject all mutating requests
    if (this.configError || this.allowedOrigins.size === 0) {
      return {
        success: false,
        code: "ORIGIN_UNTRUSTED",
        reason: "No trusted origins configured; request fails closed",
      };
    }

    if (rawOrigin === null || rawOrigin === undefined) {
      return {
        success: false,
        code: "ORIGIN_MISSING",
        reason: "Request origin header is required for mutating requests",
      };
    }

    if (rawOrigin.length > MAX_SECURITY_INPUT_LENGTH) {
      return {
        success: false,
        code: "ORIGIN_MALFORMED",
        reason: "Origin header exceeds maximum allowed length",
      };
    }

    const trimmed = rawOrigin.trim();
    if (trimmed === "" || trimmed === "null") {
      return {
        success: false,
        code: "ORIGIN_MISSING",
        reason: "Request origin cannot be empty or 'null'",
      };
    }

    // Inspect the raw string for illegal components before/during URL parsing
    // Standard Origin headers must NOT contain path, query, hash, or credentials
    if (trimmed.includes("#")) {
      return {
        success: false,
        code: "ORIGIN_HAS_FRAGMENT",
        reason: "Origin header must not contain a fragment identifier",
      };
    }

    if (trimmed.includes("?")) {
      return {
        success: false,
        code: "ORIGIN_HAS_QUERY",
        reason: "Origin header must not contain query parameters",
      };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(trimmed);
    } catch {
      return {
        success: false,
        code: "ORIGIN_MALFORMED",
        reason: "Origin header is not a valid URL",
      };
    }

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return {
        success: false,
        code: "ORIGIN_MALFORMED",
        reason: "Origin protocol must be HTTP or HTTPS",
      };
    }

    if (parsedUrl.username !== "" || parsedUrl.password !== "") {
      return {
        success: false,
        code: "ORIGIN_HAS_USERINFO",
        reason: "Origin header must not contain userinfo",
      };
    }

    if (parsedUrl.pathname !== "" && parsedUrl.pathname !== "/") {
      return {
        success: false,
        code: "ORIGIN_HAS_PATH",
        reason: "Origin header must not contain a path component",
      };
    }

    // The canonical parsed origin (e.g. "https://example.com:8080")
    const canonical = parsedUrl.origin;

    // Check exact match in explicitly enumerated allowlist
    if (!this.allowedOrigins.has(canonical)) {
      return {
        success: false,
        code: "ORIGIN_UNTRUSTED",
        reason: "Origin is not in the explicit trusted allowlist",
      };
    }

    return { success: true };
  }

  /**
   * Validates an incoming request's origin by checking Origin header first,
   * falling back to safe parsing of Referer header if Origin is absent.
   *
   * @param originHeader - Raw Origin header from the request.
   * @param refererHeader - Raw Referer header from the request.
   * @param method - HTTP request method.
   */
  public verifyRequestOrigin(
    originHeader: string | null | undefined,
    refererHeader: string | null | undefined,
    method: string,
  ): SecurityValidationResult {
    if (isSafeHttpMethod(method)) {
      return { success: true };
    }

    if (
      originHeader !== null &&
      originHeader !== undefined &&
      originHeader.trim() !== ""
    ) {
      return this.verifyOrigin(originHeader, method);
    }

    const refererResult = extractOriginFromReferer(refererHeader);
    if (!refererResult.success) {
      return refererResult;
    }

    return this.verifyOrigin(refererResult.origin, method);
  }
}

/**
 * Options for CSRF token generator and validator.
 */
export interface CsrfProtectionOptions {
  /**
   * HMAC signing secret. Must be at least 32 bytes.
   */
  readonly secret: string | Buffer;
  /**
   * Maximum token age in milliseconds. Defaults to 3600000 (1 hour).
   */
  readonly maxAgeMs?: number;
  /**
   * Injected clock function returning current epoch milliseconds (for deterministic testing).
   */
  readonly now?: () => number;
}

/**
 * Decoded CSRF payload structure.
 */
export interface DecodedCsrfToken {
  readonly version: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly randomBytesHex: string;
}

/**
 * Signs payload bytes with HMAC-SHA-256 using the configured secret.
 */
function computeHmacSignature(secretBuffer: Buffer, data: string): Buffer {
  return createHmac("sha256", secretBuffer).update(data, "utf8").digest();
}

/**
 * Fixed-length constant-time buffer comparison resisting timing attacks.
 */
function constantTimeEquals(a: Buffer, b: Buffer): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

/**
 * Signed Double-Submit Anti-CSRF Token Manager.
 *
 * Token format:
 *   version.issuedAtHex.expiresAtHex.randomBytesHex.signatureBase64url
 *
 * Invariants:
 * - 32 cryptographically random bytes generated via crypto.randomBytes(32).
 * - Versioned bounded token representation.
 * - Issued and expiry timestamps.
 * - HMAC-SHA256 signature with minimum 32-byte secret.
 * - Fixed-length timingSafeEqual constant-time verification.
 * - Requires exact token + signature match between cookie and header.
 * - Injected current time support for testing.
 * - Stable, typed failure codes that never leak raw tokens or secrets.
 */
export class CsrfProtection {
  private readonly secretBuffer: Buffer;
  private readonly maxAgeMs: number;
  private readonly getNow: () => number;

  constructor(options: CsrfProtectionOptions) {
    const rawSecret =
      typeof options.secret === "string"
        ? Buffer.from(options.secret, "utf8")
        : options.secret;

    if (
      !Buffer.isBuffer(rawSecret) ||
      rawSecret.length < MIN_CSRF_SECRET_BYTES
    ) {
      throw new Error(
        `CSRF signing secret must be at least ${MIN_CSRF_SECRET_BYTES} bytes, got ${rawSecret?.length ?? 0} bytes`,
      );
    }

    this.secretBuffer = rawSecret;
    this.maxAgeMs = options.maxAgeMs ?? DEFAULT_CSRF_MAX_AGE_MS;
    this.getNow = options.now ?? (() => Date.now());
  }

  /**
   * Generates a new signed double-submit CSRF token string.
   * Format: v1.<issuedAtHex>.<expiresAtHex>.<random32Hex>.<signatureBase64url>
   *
   * @param customNowMs - Optional override for issuance timestamp.
   */
  public generateToken(customNowMs?: number): string {
    const issuedAt = customNowMs ?? this.getNow();
    const expiresAt = issuedAt + this.maxAgeMs;

    const randomHex = randomBytes(CSRF_RAW_TOKEN_BYTES).toString("hex");
    const issuedAtHex = issuedAt.toString(16);
    const expiresAtHex = expiresAt.toString(16);

    const tokenPayload = `${CSRF_TOKEN_VERSION}.${issuedAtHex}.${expiresAtHex}.${randomHex}`;
    const signature = computeHmacSignature(this.secretBuffer, tokenPayload);
    const signatureBase64Url = signature.toString("base64url");

    return `${tokenPayload}.${signatureBase64Url}`;
  }

  /**
   * Verifies the cryptographic signature, expiration, and format of a CSRF token.
   * Does NOT leak raw token contents in returned error details.
   *
   * @param tokenString - Candidate token string.
   * @param customNowMs - Optional override for current timestamp.
   */
  public verifyTokenString(
    tokenString: unknown,
    customNowMs?: number,
  ): SecurityValidationResult {
    if (typeof tokenString !== "string" || tokenString.trim() === "") {
      return {
        success: false,
        code: "CSRF_TOKEN_MALFORMED",
        reason: "CSRF token must be a non-empty string",
      };
    }

    if (tokenString.length > MAX_SECURITY_INPUT_LENGTH) {
      return {
        success: false,
        code: "CSRF_TOKEN_MALFORMED",
        reason: "CSRF token exceeds maximum allowed length",
      };
    }

    const parts = tokenString.trim().split(".");
    if (parts.length !== 5) {
      return {
        success: false,
        code: "CSRF_TOKEN_MALFORMED",
        reason: "CSRF token structure is invalid",
      };
    }

    const [version, issuedAtHex, expiresAtHex, randomHex, signatureBase64Url] =
      parts;

    if (version !== CSRF_TOKEN_VERSION) {
      return {
        success: false,
        code: "CSRF_VERSION_UNSUPPORTED",
        reason: "CSRF token version is not supported",
      };
    }

    const issuedAt = parseInt(issuedAtHex, 16);
    const expiresAt = parseInt(expiresAtHex, 16);

    if (
      !Number.isFinite(issuedAt) ||
      !Number.isFinite(expiresAt) ||
      issuedAt <= 0 ||
      expiresAt <= issuedAt
    ) {
      return {
        success: false,
        code: "CSRF_TOKEN_MALFORMED",
        reason: "CSRF token timestamps are invalid",
      };
    }

    if (
      !/^[0-9a-f]{64}$/i.test(randomHex) ||
      randomHex.length !== CSRF_RAW_TOKEN_BYTES * 2
    ) {
      return {
        success: false,
        code: "CSRF_TOKEN_MALFORMED",
        reason: "CSRF token entropy component is invalid",
      };
    }

    let candidateSignature: Buffer;
    try {
      candidateSignature = Buffer.from(signatureBase64Url, "base64url");
    } catch {
      return {
        success: false,
        code: "CSRF_SIGNATURE_INVALID",
        reason: "CSRF token signature encoding is invalid",
      };
    }

    // Expected HMAC-SHA-256 length is 32 bytes
    if (candidateSignature.length !== 32) {
      return {
        success: false,
        code: "CSRF_SIGNATURE_INVALID",
        reason: "CSRF token signature length is invalid",
      };
    }

    // Verify HMAC signature over token payload
    const tokenPayload = `${version}.${issuedAtHex}.${expiresAtHex}.${randomHex}`;
    const expectedSignature = computeHmacSignature(
      this.secretBuffer,
      tokenPayload,
    );

    if (!constantTimeEquals(candidateSignature, expectedSignature)) {
      return {
        success: false,
        code: "CSRF_SIGNATURE_INVALID",
        reason: "CSRF token signature mismatch",
      };
    }

    // Verify timestamps with injected clock
    const now = customNowMs ?? this.getNow();

    // Reject tokens issued in the future (allowing slight 5000ms clock skew)
    if (issuedAt > now + 5000) {
      return {
        success: false,
        code: "CSRF_TIMESTAMP_FUTURE",
        reason: "CSRF token issued timestamp is in the future",
      };
    }

    if (now > expiresAt) {
      return {
        success: false,
        code: "CSRF_TOKEN_EXPIRED",
        reason: "CSRF token has expired",
      };
    }

    return { success: true };
  }

  /**
   * Verifies double-submit CSRF protection for an incoming request.
   *
   * Enforces:
   * 1. Safe HTTP methods (GET/HEAD/OPTIONS) pass through without requiring CSRF checks.
   * 2. Cookie token and header token must both be present.
   * 3. Cookie token and header token must be byte-for-byte identical (verified timing-safe).
   * 4. Token payload must be cryptographically valid, correctly signed, and unexpired.
   *
   * @param cookieToken - Token extracted from the __Host-logos_csrf cookie.
   * @param headerToken - Token extracted from the X-CSRF-Token header.
   * @param method - HTTP request method.
   * @param customNowMs - Injected timestamp for deterministic tests.
   */
  public verifyDoubleSubmit(
    cookieToken: string | null | undefined,
    headerToken: string | null | undefined,
    method: string,
    customNowMs?: number,
  ): SecurityValidationResult {
    // Safe methods never mutate state and do not require CSRF token
    if (isSafeHttpMethod(method)) {
      return { success: true };
    }

    if (!cookieToken || cookieToken.trim() === "") {
      return {
        success: false,
        code: "CSRF_COOKIE_MISSING",
        reason: "Missing required CSRF cookie",
      };
    }

    if (!headerToken || headerToken.trim() === "") {
      return {
        success: false,
        code: "CSRF_HEADER_MISSING",
        reason: "Missing required CSRF header",
      };
    }

    if (
      cookieToken.length > MAX_SECURITY_INPUT_LENGTH ||
      headerToken.length > MAX_SECURITY_INPUT_LENGTH
    ) {
      return {
        success: false,
        code: "CSRF_TOKEN_MALFORMED",
        reason: "CSRF token exceeds maximum allowed length",
      };
    }

    const trimmedCookie = cookieToken.trim();
    const trimmedHeader = headerToken.trim();

    // Constant-time check between cookie and header token strings
    const cookieBuf = Buffer.from(trimmedCookie, "utf8");
    const headerBuf = Buffer.from(trimmedHeader, "utf8");

    if (!constantTimeEquals(cookieBuf, headerBuf)) {
      return {
        success: false,
        code: "CSRF_TOKEN_MISMATCH",
        reason: "CSRF cookie and header values do not match",
      };
    }

    // Verify token validity and signature
    return this.verifyTokenString(trimmedCookie, customNowMs);
  }
}

/**
 * Options for CSRF cookie creation.
 */
export interface CsrfCookieOptions {
  /**
   * Maximum cookie lifetime in seconds (default 3600).
   */
  readonly maxAgeSeconds?: number;
}

/**
 * Creates the compliant Set-Cookie header value for the __Host-logos_csrf cookie.
 *
 * Mandatory __Host- and Phase Contract Invariants:
 * - __Host- prefix requires Path=/ and Secure (always enforced; no insecure overrides).
 * - SameSite=Strict (always enforced; no Lax/None overrides).
 * - No Domain attribute (origin bound).
 * - Non-HttpOnly (client-readable so frontend scripts can read and echo token into X-CSRF-Token header).
 * - Input validation: token must be a non-empty string <= MAX_SECURITY_INPUT_LENGTH.
 *
 * @param token - Signed CSRF token string.
 * @param options - Optional configuration options.
 */
export function createCsrfCookieHeader(
  token: string,
  options?: CsrfCookieOptions,
): string {
  if (
    typeof token !== "string" ||
    token.trim() === "" ||
    token.length > MAX_SECURITY_INPUT_LENGTH
  ) {
    throw new Error("Invalid CSRF token for cookie header generation");
  }

  const trimmedToken = token.trim();
  const maxAge =
    options?.maxAgeSeconds !== undefined &&
    Number.isInteger(options.maxAgeSeconds) &&
    options.maxAgeSeconds > 0 &&
    options.maxAgeSeconds <= 86400 * 30
      ? options.maxAgeSeconds
      : 3600;

  return `${CSRF_COOKIE_NAME}=${trimmedToken}; Path=/; SameSite=Strict; Max-Age=${maxAge}; Secure`;
}

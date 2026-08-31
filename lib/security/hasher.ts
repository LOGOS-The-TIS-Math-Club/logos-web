import { createHmac } from "node:crypto";

/**
 * Minimum required byte length for the rate limit secret key (256 bits).
 */
export const MIN_RATE_LIMIT_SECRET_BYTES = 32;

/**
 * Options for subject hashing.
 */
export interface SubjectHasherOptions {
  /**
   * Secret key for HMAC-SHA-256 computation. Must be at least 32 bytes.
   */
  readonly secret: string | Buffer;
}

/**
 * Subject hasher for privacy-preserving rate limiting.
 *
 * Enforces:
 * - HMAC-SHA-256 computation with purpose-specific domain separation:
 *   hash = HMAC-SHA-256(secret, purpose + ":" + rawIdentifier)
 * - Minimum 32-byte secret key verification.
 * - Normalized lowercase 64-character hexadecimal output.
 * - Raw identifiers (e.g. client IP addresses) are never stored or reflected.
 */
export class SubjectHasher {
  private readonly secretBuffer: Buffer;

  constructor(options: SubjectHasherOptions) {
    const rawSecret =
      typeof options.secret === "string"
        ? Buffer.from(options.secret, "utf8")
        : options.secret;

    if (
      !Buffer.isBuffer(rawSecret) ||
      rawSecret.length < MIN_RATE_LIMIT_SECRET_BYTES
    ) {
      throw new Error(
        `Rate limit secret must be at least ${MIN_RATE_LIMIT_SECRET_BYTES} bytes, got ${rawSecret?.length ?? 0} bytes`,
      );
    }

    this.secretBuffer = rawSecret;
  }

  /**
   * Computes a deterministic HMAC-SHA-256 subject hash for a given purpose and identifier.
   *
   * @param purpose - Non-empty operational context (e.g. 'auth:login', 'form:submission').
   * @param identifier - Non-empty raw identifier (e.g. client IP or identifier string).
   * @returns 64-character hexadecimal hash string.
   */
  public hashSubject(purpose: string, identifier: string): string {
    const trimmedPurpose = purpose.trim();
    const trimmedIdentifier = identifier.trim();

    if (trimmedPurpose === "") {
      throw new Error("Rate limit purpose must be a non-empty string");
    }
    if (trimmedIdentifier === "") {
      throw new Error("Rate limit identifier must be a non-empty string");
    }

    const payload = `${trimmedPurpose}:${trimmedIdentifier}`;
    return createHmac("sha256", this.secretBuffer)
      .update(payload, "utf8")
      .digest("hex");
  }
}

/**
 * Computes an HMAC-SHA-256 subject hash using an explicit secret string/buffer.
 *
 * @param secret - HMAC secret key (minimum 32 bytes).
 * @param purpose - Purpose salt.
 * @param identifier - Raw identifier.
 */
export function hashSubject(
  secret: string | Buffer,
  purpose: string,
  identifier: string,
): string {
  const hasher = new SubjectHasher({ secret });
  return hasher.hashSubject(purpose, identifier);
}

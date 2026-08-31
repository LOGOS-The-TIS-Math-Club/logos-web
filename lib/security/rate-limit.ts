import { sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import "server-only";

import { hashSubject, MIN_RATE_LIMIT_SECRET_BYTES } from "./hasher";

/**
 * Rate limiting policy definition.
 */
export interface RateLimitPolicy {
  readonly name: string;
  readonly windowSeconds: number;
  readonly maxRequests: number;
}

/**
 * Documented Phase 03 & Future Presets (docs/phase-03.md Section 9.4).
 */
export const AUTH_ATTEMPT_POLICY: RateLimitPolicy = Object.freeze({
  name: "auth_attempt",
  windowSeconds: 900, // 15 minutes
  maxRequests: 5,
});

export const FORM_SUBMISSION_POLICY: RateLimitPolicy = Object.freeze({
  name: "form_submission",
  windowSeconds: 600, // 10 minutes
  maxRequests: 60,
});

export const SYNTHETIC_TEST_POLICY: RateLimitPolicy = Object.freeze({
  name: "synthetic_test_policy",
  windowSeconds: 60, // 60 seconds
  maxRequests: 5,
});

/**
 * Rate limit check result.
 */
export type RateLimitResult =
  | {
      readonly success: true;
      readonly policy: string;
      readonly limit: number;
      readonly currentCount: number;
      readonly remaining: number;
      readonly resetAt: Date;
    }
  | {
      readonly success: false;
      readonly policy: string;
      readonly limit: number;
      readonly currentCount: number;
      readonly retryAfterSeconds: number;
      readonly resetAt: Date;
    };

export interface CheckRateLimitOptions {
  /**
   * Drizzle PostgreSQL database client or transaction instance.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly db: PgDatabase<any, any, any>;
  /**
   * The policy to evaluate against.
   */
  readonly policy: RateLimitPolicy;
  /**
   * Raw identifier to hash (e.g. client IP or identifier string).
   * Note: NEVER stored raw. Hashed with purpose salt before DB write.
   */
  readonly rawIdentifier: string;
  /**
   * HMAC secret for subject hashing. Defaults to process.env.RATE_LIMIT_SECRET.
   */
  readonly secret?: string;
  /**
   * Optional custom purpose salt. Defaults to policy.name.
   */
  readonly purpose?: string;
}

/**
 * Executes an atomic, database-backed fixed-window rate limit check in PostgreSQL 17.
 *
 * Invariants:
 * - Window boundaries evaluated using PostgreSQL clock_timestamp().
 * - Raw identifiers are never stored or logged; HMAC-SHA-256 hashed with purpose salt.
 * - Single atomic SQL statement (`INSERT ... ON CONFLICT DO UPDATE RETURNING count, window_start`).
 * - Returns 429-ready metadata (retryAfterSeconds, resetAt, limit, currentCount).
 * - Fails closed if secret is invalid.
 */
export async function checkRateLimit(
  options: CheckRateLimitOptions,
): Promise<RateLimitResult> {
  const secret = options.secret ?? process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < MIN_RATE_LIMIT_SECRET_BYTES) {
    throw new Error(
      `Rate limit secret must be at least ${MIN_RATE_LIMIT_SECRET_BYTES} bytes.`,
    );
  }

  const { db, policy, rawIdentifier } = options;
  const purpose = options.purpose ?? policy.name;

  if (policy.windowSeconds <= 0 || policy.maxRequests <= 0) {
    throw new Error(
      "Invalid rate limit policy parameters: window and maxRequests must be positive",
    );
  }

  const subjectHash = hashSubject(secret, purpose, rawIdentifier);

  // Atomic window computation and count increment using database clock
  const queryResult = await db.execute<{
    count: number;
    window_start: string | Date;
    reset_at: string | Date;
    clock_now: string | Date;
  }>(sql`
    WITH window_calc AS (
      SELECT
        clock_timestamp() AS clock_now,
        to_timestamp(
          floor(extract(epoch from clock_timestamp()) / ${policy.windowSeconds}) * ${policy.windowSeconds}
        ) AS window_start
    )
    INSERT INTO logos.rate_limits (subject_hash, policy, window_start, count)
    SELECT
      ${subjectHash},
      ${policy.name},
      window_start,
      1
    FROM window_calc
    ON CONFLICT (subject_hash, policy, window_start)
    DO UPDATE SET count = logos.rate_limits.count + 1
    RETURNING
      logos.rate_limits.count,
      logos.rate_limits.window_start,
      (logos.rate_limits.window_start + (${policy.windowSeconds} || ' seconds')::interval) AS reset_at,
      clock_timestamp() AS clock_now;
  `);

  const row = queryResult.rows[0];
  if (!row) {
    throw new Error("Rate limit query returned no result");
  }

  const currentCount = Number(row.count);
  const resetAt = new Date(row.reset_at);
  const clockNow = new Date(row.clock_now);

  if (currentCount <= policy.maxRequests) {
    const remaining = Math.max(0, policy.maxRequests - currentCount);
    return {
      success: true,
      policy: policy.name,
      limit: policy.maxRequests,
      currentCount,
      remaining,
      resetAt,
    };
  }

  // Calculate retry after seconds from database clock
  const diffMs = resetAt.getTime() - clockNow.getTime();
  const retryAfterSeconds = Math.max(1, Math.ceil(diffMs / 1000));

  return {
    success: false,
    policy: policy.name,
    limit: policy.maxRequests,
    currentCount,
    retryAfterSeconds,
    resetAt,
  };
}

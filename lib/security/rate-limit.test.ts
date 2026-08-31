import { describe, expect, test, vi } from "vitest";

import {
  AUTH_ATTEMPT_POLICY,
  checkRateLimit,
  FORM_SUBMISSION_POLICY,
  SYNTHETIC_TEST_POLICY,
} from "./rate-limit";

describe("PostgreSQL Atomic Shared Rate Limiter", () => {
  const VALID_SECRET = "a_super_secret_rate_limit_key_of_32_bytes_len!";

  test("documents and freezes standard policy presets", () => {
    expect(AUTH_ATTEMPT_POLICY).toEqual({
      name: "auth_attempt",
      windowSeconds: 900,
      maxRequests: 5,
    });
    expect(FORM_SUBMISSION_POLICY).toEqual({
      name: "form_submission",
      windowSeconds: 600,
      maxRequests: 60,
    });
    expect(SYNTHETIC_TEST_POLICY).toEqual({
      name: "synthetic_test_policy",
      windowSeconds: 60,
      maxRequests: 5,
    });
  });

  test("throws error when rate limit secret is missing or under 32 bytes", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDb: any = { execute: vi.fn() };

    await expect(
      checkRateLimit({
        db: mockDb,
        policy: SYNTHETIC_TEST_POLICY,
        rawIdentifier: "192.0.2.1",
        secret: "short_secret",
      }),
    ).rejects.toThrow(/at least 32 bytes/);
  });

  test("throws error when policy parameters are invalid", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDb: any = { execute: vi.fn() };

    await expect(
      checkRateLimit({
        db: mockDb,
        policy: { name: "invalid", windowSeconds: 0, maxRequests: 5 },
        rawIdentifier: "192.0.2.1",
        secret: VALID_SECRET,
      }),
    ).rejects.toThrow(/must be positive/);
  });

  test("returns success with remaining count when count <= maxRequests", async () => {
    const mockReset = new Date("2026-08-31T20:31:00.000Z");
    const mockNow = new Date("2026-08-31T20:30:15.000Z");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDb: any = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            count: 2,
            window_start: "2026-08-31T20:30:00.000Z",
            reset_at: mockReset.toISOString(),
            clock_now: mockNow.toISOString(),
          },
        ],
      }),
    };

    const result = await checkRateLimit({
      db: mockDb,
      policy: SYNTHETIC_TEST_POLICY,
      rawIdentifier: "192.0.2.1",
      secret: VALID_SECRET,
    });

    expect(result).toEqual({
      success: true,
      policy: "synthetic_test_policy",
      limit: 5,
      currentCount: 2,
      remaining: 3,
      resetAt: mockReset,
    });
    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  });

  test("returns rejection with retryAfterSeconds when count > maxRequests", async () => {
    const mockReset = new Date("2026-08-31T20:31:00.000Z");
    const mockNow = new Date("2026-08-31T20:30:20.000Z"); // 40 seconds left in window

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mockDb: any = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            count: 6,
            window_start: "2026-08-31T20:30:00.000Z",
            reset_at: mockReset.toISOString(),
            clock_now: mockNow.toISOString(),
          },
        ],
      }),
    };

    const result = await checkRateLimit({
      db: mockDb,
      policy: SYNTHETIC_TEST_POLICY,
      rawIdentifier: "192.0.2.1",
      secret: VALID_SECRET,
    });

    expect(result).toEqual({
      success: false,
      policy: "synthetic_test_policy",
      limit: 5,
      currentCount: 6,
      retryAfterSeconds: 40,
      resetAt: mockReset,
    });
  });
});

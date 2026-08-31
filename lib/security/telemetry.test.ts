import * as Sentry from "@sentry/nextjs";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import {
  createHardenedSentryConfig,
  safeCaptureException,
  sanitizeSentryEvent,
  sanitizeSentryTransaction,
} from "./telemetry";

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
  withScope: vi.fn((callback: (scope: unknown) => void) => {
    const mockScope = {
      setTag: vi.fn(),
      setExtras: vi.fn(),
    };
    callback(mockScope);
    return mockScope;
  }),
  captureRequestError: vi.fn(),
  init: vi.fn(),
}));

describe("Sanitized Zero-Cost Telemetry Configuration", () => {
  const TEST_DSN = "https://public@sentry.example.com/123";
  const TEST_CORRELATION_ID = "550e8400-e29b-41d4-a716-446655440000";

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SENTRY_DSN;
  });

  afterEach(() => {
    delete process.env.SENTRY_DSN;
  });

  describe("Zero Initialization without DSN", () => {
    test("returns null when SENTRY_DSN is absent", () => {
      const config = createHardenedSentryConfig({});
      expect(config).toBeNull();
    });

    test("returns null when SENTRY_DSN is empty string", () => {
      const config = createHardenedSentryConfig({ SENTRY_DSN: "  " });
      expect(config).toBeNull();
    });
  });

  describe("Developer Free-Tier Bounds & Replay Prohibitions", () => {
    test("sets tracesSampleRate to 0.0 and disables replays when DSN exists", () => {
      const config = createHardenedSentryConfig({
        SENTRY_DSN: TEST_DSN,
        APP_ENV: "preview",
      });

      expect(config).not.toBeNull();
      expect(config?.dsn).toBe(TEST_DSN);
      expect(config?.environment).toBe("preview");
      expect(config?.tracesSampleRate).toBe(0.0);
      expect(config?.replaysSessionSampleRate).toBe(0.0);
      expect(config?.replaysOnErrorSampleRate).toBe(0.0);
      expect(config?.sendDefaultPii).toBe(false);
    });
  });

  describe("Event Scrubbing and Privacy Hooks", () => {
    test("strips request headers, cookies, and query strings", () => {
      const rawEvent = {
        request: {
          headers: { Authorization: "Bearer secret-token", Cookie: "sess=123" },
          cookies: { session: "xyz" },
          query_string: "code=oauth123",
          url: "https://example.com/callback?code=oauth123",
        },
      };

      const cleaned = sanitizeSentryEvent(rawEvent);

      expect(cleaned.request?.headers).toBeUndefined();
      expect(cleaned.request?.cookies).toBeUndefined();
      expect(cleaned.request?.query_string).toBeUndefined();
      expect(cleaned.request?.url).toBe("https://example.com/callback");
    });

    test("erases user ID, IP address, email, and username", () => {
      const rawEvent = {
        user: {
          id: "user-456",
          ip_address: "192.0.2.1",
          email: "student@school.edu",
          username: "student123",
        },
      };

      const cleaned = sanitizeSentryEvent(rawEvent);

      expect(cleaned.user?.id).toBeUndefined();
      expect(cleaned.user?.ip_address).toBeUndefined();
      expect(cleaned.user?.email).toBeUndefined();
      expect(cleaned.user?.username).toBeUndefined();
    });

    test("scrubs sensitive strings from exception values and message", () => {
      const rawEvent = {
        message:
          "Failed connecting postgresql://admin:secret@db.internal:5432/prod",
        exception: {
          values: [
            {
              type: "DatabaseError",
              value: "Error on table logos.user with email user@school.edu",
            },
          ],
        },
      };

      const cleaned = sanitizeSentryEvent(rawEvent);

      expect(cleaned.message).toContain("[REDACTED_DB_URL]");
      expect(cleaned.exception?.values?.[0]?.value).toContain(
        "[REDACTED_EMAIL]",
      );
    });

    test("injects correlation ID tag if present in extra or hint", () => {
      const rawEvent = {
        extra: { correlationId: TEST_CORRELATION_ID },
      };

      const cleaned = sanitizeSentryEvent(rawEvent);

      expect(cleaned.tags?.correlationId).toBe(TEST_CORRELATION_ID);
    });

    test("sanitizes transaction spans and descriptions", () => {
      const rawTx = {
        transaction: "GET /api/user?token=secret123",
        spans: [
          {
            description: "SELECT * FROM db WHERE email = 'student@school.edu'",
          },
        ],
      };

      const cleaned = sanitizeSentryTransaction(rawTx);

      expect(cleaned.transaction).not.toContain("secret123");
      expect(cleaned.spans?.[0]?.description).toContain("[REDACTED_EMAIL]");
    });
  });

  describe("Non-Fatal Telemetry Wrapper", () => {
    test("does not invoke Sentry when SENTRY_DSN is absent", () => {
      delete process.env.SENTRY_DSN;

      safeCaptureException(new Error("Unconfigured error"), {
        correlationId: TEST_CORRELATION_ID,
      });

      expect(Sentry.captureException).not.toHaveBeenCalled();
      expect(Sentry.withScope).not.toHaveBeenCalled();
    });

    test("invokes Sentry captureException with scope and context when SENTRY_DSN is present", () => {
      process.env.SENTRY_DSN = TEST_DSN;
      const testError = new Error("Configured error");
      const context = {
        correlationId: TEST_CORRELATION_ID,
        extraData: "safe_value",
      };

      safeCaptureException(testError, context);

      expect(Sentry.withScope).toHaveBeenCalledTimes(1);
      expect(Sentry.captureException).toHaveBeenCalledWith(testError);
    });

    test("safeCaptureException does not throw even if telemetry fails or throws", () => {
      process.env.SENTRY_DSN = TEST_DSN;
      vi.mocked(Sentry.withScope).mockImplementationOnce(() => {
        throw new Error("Sentry transport failure");
      });

      expect(() => {
        safeCaptureException(new Error("Boom"), {
          correlationId: TEST_CORRELATION_ID,
        });
      }).not.toThrow();
    });
  });
});

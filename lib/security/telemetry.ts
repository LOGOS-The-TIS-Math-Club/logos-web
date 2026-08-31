import * as Sentry from "@sentry/nextjs";

import { sanitizeString } from "./redaction";

/**
 * Baseline Sentry configuration options enforcing zero-cost Developer tier and strict data privacy.
 */
export interface SentryConfigOptions {
  readonly dsn?: string;
  readonly environment?: string;
  readonly tracesSampleRate?: number;
  readonly replaysSessionSampleRate?: number;
  readonly replaysOnErrorSampleRate?: number;
  readonly sendDefaultPii?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly beforeSend?: (event: any, hint?: any) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly beforeSendTransaction?: (event: any) => any;
}

export interface SentryEvent {
  message?: string;
  exception?: {
    values?: Array<{
      type?: string;
      value?: string;
      stacktrace?: unknown;
    }>;
  };
  request?: {
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    query_string?: string;
    url?: string;
  };
  user?: {
    id?: string;
    ip_address?: string;
    email?: string;
    username?: string;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface SentryTransactionEvent {
  transaction?: string;
  spans?: Array<{
    description?: string;
    op?: string;
  }>;
}

/**
 * Cleans an error or message event before transmission to Sentry.
 *
 * Invariants (docs/phase-03.md Section 14):
 * - Strips headers, cookies, query string.
 * - Removes client IP and user identifiers (sendDefaultPii: false).
 * - Redacts sensitive tokens/strings in messages and exception values.
 * - Injects correlation ID as a searchable event tag.
 */
export function sanitizeSentryEvent(
  event: SentryEvent,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hint?: any,
): SentryEvent {
  // 1. Strip request headers, cookies, and query strings
  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.query_string;
    if (event.request.url) {
      event.request.url = sanitizeString(event.request.url);
    }
  }

  // 2. Erase user identifiers and IP addresses
  if (event.user) {
    event.user = {
      id: undefined,
      ip_address: undefined,
      email: undefined,
      username: undefined,
    };
  }

  // 3. Scrub exception values and messages
  if (event.message) {
    event.message = sanitizeString(event.message);
  }

  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) {
        ex.value = sanitizeString(ex.value);
      }
    }
  }

  // 4. Extract correlationId and set as searchable tag
  const correlationId =
    event.tags?.correlationId ??
    (event.extra?.correlationId as string | undefined) ??
    (hint?.correlationId as string | undefined);

  if (correlationId) {
    event.tags = {
      ...event.tags,
      correlationId,
    };
  }

  return event;
}

/**
 * Sanitizes performance transaction events and span descriptions.
 */
export function sanitizeSentryTransaction(
  event: SentryTransactionEvent,
): SentryTransactionEvent {
  if (event.transaction) {
    // Strip query parameters and hash from transaction name before sanitizing
    const withoutQuery = event.transaction
      .replace(/\?[^#\s]*/g, "")
      .replace(/#[^\s]*/g, "");
    event.transaction = sanitizeString(withoutQuery);
  }

  if (event.spans) {
    for (const span of event.spans) {
      if (span.description) {
        span.description = sanitizeString(span.description);
      }
    }
  }

  return event;
}

/**
 * Builds the hardened, zero-cost Sentry SDK configuration options.
 * Returns null if SENTRY_DSN is absent (zero initialization / no-op mode).
 */
export function createHardenedSentryConfig(
  env: Record<string, string | undefined> = process.env,
): SentryConfigOptions | null {
  const dsn = env.SENTRY_DSN;
  if (!dsn || dsn.trim() === "") {
    return null;
  }

  return {
    dsn: dsn.trim(),
    environment: env.APP_ENV ?? env.NODE_ENV ?? "development",
    tracesSampleRate: 0.0, // Tracing OFF by default to preserve free tier quota
    replaysSessionSampleRate: 0.0, // Replay strictly prohibited
    replaysOnErrorSampleRate: 0.0, // Replay strictly prohibited
    sendDefaultPii: false, // PII disabled
    beforeSend: sanitizeSentryEvent,
    beforeSendTransaction: sanitizeSentryTransaction,
  };
}

/**
 * Safe wrapper for capturing exceptions to Sentry.
 * Guarantees non-fatal failure: telemetry issues never crash application workflows.
 * Only transmits when SENTRY_DSN is configured.
 */
export function safeCaptureException(
  error: unknown,
  context?: { correlationId?: string; [key: string]: unknown },
): void {
  try {
    const config = createHardenedSentryConfig();
    if (!config) {
      return; // No-op when DSN not configured
    }

    Sentry.withScope((scope) => {
      if (context?.correlationId) {
        scope.setTag("correlationId", context.correlationId);
      }
      if (context) {
        scope.setExtras(context);
      }
      Sentry.captureException(error);
    });
  } catch {
    // Non-fatal telemetry swallow: telemetry issues never crash application workflows
  }
}

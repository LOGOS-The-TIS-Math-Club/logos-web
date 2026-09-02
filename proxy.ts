import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  CORRELATION_HEADER_NAME,
  CORRELATION_HEADER_NAME_CANONICAL,
  generateCorrelationId,
} from "./lib/security/correlation";
import { createSafeErrorResponse } from "./lib/security/errors";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  createCsrfCookieHeader,
  CsrfProtection,
  isSafeHttpMethod,
  OriginVerifier,
} from "./lib/security/origin-csrf";
import {
  processAuthMiddleware,
  DEFAULT_AUTH_SKIP_ROUTES,
} from "@neondatabase/auth/server";

function createContentSecurityPolicy(nonce: string): string {
  const development = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "img-src 'self' data:",
    "font-src 'self'",
    `connect-src 'self'${development ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Cache references tracking the environment values used to construct verifiers.
 */
let cachedAppUrl: string | undefined;
let cachedTrustedOriginsRaw: string | undefined;
let cachedOriginVerifier: OriginVerifier | null = null;

function getOriginVerifier(): OriginVerifier {
  const currentAppUrl = process.env.APP_URL;
  const currentTrusted = process.env.TRUSTED_ORIGINS;

  if (
    !cachedOriginVerifier ||
    cachedAppUrl !== currentAppUrl ||
    cachedTrustedOriginsRaw !== currentTrusted
  ) {
    const trustedOrigins = currentTrusted
      ? currentTrusted
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;

    cachedOriginVerifier = new OriginVerifier({
      appUrl: currentAppUrl,
      trustedOrigins,
    });
    cachedAppUrl = currentAppUrl;
    cachedTrustedOriginsRaw = currentTrusted;
  }
  return cachedOriginVerifier;
}

let cachedSecret: string | undefined;
let cachedCsrfProtection: CsrfProtection | null = null;

function getCsrfProtection(): CsrfProtection | null {
  const secret = process.env.CSRF_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    return null;
  }
  if (!cachedCsrfProtection || cachedSecret !== secret) {
    cachedCsrfProtection = new CsrfProtection({ secret });
    cachedSecret = secret;
  }
  return cachedCsrfProtection;
}

/**
 * Attaches standard baseline security headers to an outgoing response.
 */
function applySecurityHeaders(
  headers: Headers,
  contentSecurityPolicy: string,
  correlationId: string,
): void {
  headers.set("Content-Security-Policy", contentSecurityPolicy);
  headers.set(
    "Permissions-Policy",
    "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  );
  headers.set("Referrer-Policy", "no-referrer");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  headers.set(CORRELATION_HEADER_NAME_CANONICAL, correlationId);
}

export async function proxy(request: NextRequest) {
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

  // If returning from OAuth with a session verifier, exchange it via Neon Auth
  if (
    request.nextUrl.searchParams.has("neon_auth_session_verifier") &&
    baseUrl &&
    cookieSecret &&
    cookieSecret.length >= 32
  ) {
    const result = await processAuthMiddleware({
      request,
      pathname: request.nextUrl.pathname,
      skipRoutes: DEFAULT_AUTH_SKIP_ROUTES,
      loginUrl: "/auth/sign-in",
      baseUrl,
      cookieSecret,
      sessionDataTtl: 60,
      sameSite: "lax",
    });

    if (result.action === "redirect_oauth") {
      const correlationId = generateCorrelationId();
      const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
      const contentSecurityPolicy = createContentSecurityPolicy(nonce);

      const oauthHeaders = new Headers();
      for (const cookie of result.cookies) {
        oauthHeaders.append("Set-Cookie", cookie);
      }
      const response = NextResponse.redirect(result.redirectUrl, {
        headers: oauthHeaders,
      });
      applySecurityHeaders(
        response.headers,
        contentSecurityPolicy,
        correlationId,
      );
      return response;
    }
  }

  // Always generate a fresh, untrusted server correlation ID (ignores client header)
  const correlationId = generateCorrelationId();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const contentSecurityPolicy = createContentSecurityPolicy(nonce);

  // Prepare security headers dictionary for potential rejection response
  const rejectionHeaders = new Headers();
  applySecurityHeaders(rejectionHeaders, contentSecurityPolicy, correlationId);

  const isSafe = isSafeHttpMethod(request.method);
  let cookieToSet: string | null = null;

  if (isSafe) {
    // Safe HTTP methods (GET, HEAD, OPTIONS) are strictly read-only and idempotent.
    // When CSRF protection is configured, issue or refresh the signed __Host-logos_csrf cookie
    // so client scripts can read and echo the token in subsequent mutating requests.
    const csrfProtection = getCsrfProtection();
    if (csrfProtection) {
      const incomingCookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
      if (
        !incomingCookieToken ||
        !csrfProtection.verifyTokenString(incomingCookieToken).success
      ) {
        const newToken = csrfProtection.generateToken();
        cookieToSet = createCsrfCookieHeader(newToken);
      }
    }
  } else {
    // Mutating HTTP methods (POST, PUT, PATCH, DELETE, and unknown methods)
    // require strict Origin/Referer verification and signed double-submit CSRF verification.
    const originVerifier = getOriginVerifier();
    const originResult = originVerifier.verifyRequestOrigin(
      request.headers.get("origin"),
      request.headers.get("referer"),
      request.method,
    );

    if (!originResult.success) {
      return createSafeErrorResponse(
        "FORBIDDEN_ORIGIN",
        403,
        correlationId,
        "Request origin or anti-CSRF verification failed.",
        rejectionHeaders,
      );
    }

    const csrfProtection = getCsrfProtection();
    if (!csrfProtection) {
      // CSRF secret missing or misconfigured in runtime: fail closed
      return createSafeErrorResponse(
        "INTERNAL_SERVER_ERROR",
        500,
        correlationId,
        "An unexpected error occurred. Please reference the correlation ID if reporting this issue.",
        rejectionHeaders,
      );
    }

    const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    const headerToken = request.headers.get(CSRF_HEADER_NAME);

    const csrfResult = csrfProtection.verifyDoubleSubmit(
      cookieToken,
      headerToken,
      request.method,
    );

    if (!csrfResult.success) {
      return createSafeErrorResponse(
        "FORBIDDEN_ORIGIN",
        403,
        correlationId,
        "Request origin or anti-CSRF verification failed.",
        rejectionHeaders,
      );
    }
  }

  // Request passed security checks: propagate correlation ID and nonce downstream
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CORRELATION_HEADER_NAME, correlationId);
  requestHeaders.set(CORRELATION_HEADER_NAME_CANONICAL, correlationId);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Attach baseline security headers and server correlation ID to outgoing response
  applySecurityHeaders(response.headers, contentSecurityPolicy, correlationId);

  // Attach CSRF cookie if issued/refreshed
  if (cookieToSet) {
    response.headers.set("Set-Cookie", cookieToSet);
  }

  return response;
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};

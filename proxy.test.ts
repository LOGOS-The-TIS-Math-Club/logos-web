import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import {
  CORRELATION_HEADER_NAME,
  CORRELATION_HEADER_NAME_CANONICAL,
} from "./lib/security/correlation";
import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CsrfProtection,
  MAX_SECURITY_INPUT_LENGTH,
} from "./lib/security/origin-csrf";
import { proxy } from "./proxy";

describe("Proxy Security Middleware", () => {
  const ORIGINAL_ENV = process.env;
  const TEST_SECRET =
    "a_super_secret_test_key_at_least_32_bytes_long_123456789!";
  const TEST_APP_URL = "http://localhost:3000";
  const TEST_TRUSTED_ORIGINS =
    "http://localhost:3000;https://trusted.example.com";

  let csrf: CsrfProtection;

  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "production",
      APP_URL: TEST_APP_URL,
      TRUSTED_ORIGINS: TEST_TRUSTED_ORIGINS,
      CSRF_SIGNING_SECRET: TEST_SECRET,
    };
    csrf = new CsrfProtection({ secret: TEST_SECRET });
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  function createRequest(
    method: string,
    path: string,
    options?: {
      headers?: Record<string, string>;
      cookies?: Record<string, string>;
    },
  ): NextRequest {
    const url = `http://localhost:3000${path}`;
    const headers = new Headers(options?.headers);

    if (options?.cookies) {
      const cookieStr = Object.entries(options.cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
      headers.set("cookie", cookieStr);
    }

    return new NextRequest(new URL(url), {
      method,
      headers,
    });
  }

  describe("Server-Generated Correlation IDs", () => {
    test("generates fresh correlation ID and attaches to response", () => {
      const request = createRequest("GET", "/");
      const response = proxy(request);

      const correlationHeader = response.headers.get("x-correlation-id");
      expect(correlationHeader).toBeTruthy();
      expect(correlationHeader).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });

    test("distrusts client-supplied X-Correlation-ID and generates a fresh server ID", () => {
      const spoofedClientUuid = "00000000-0000-0000-0000-000000000000";
      const request = createRequest("GET", "/", {
        headers: {
          [CORRELATION_HEADER_NAME]: spoofedClientUuid,
          [CORRELATION_HEADER_NAME_CANONICAL]: spoofedClientUuid,
        },
      });

      const response = proxy(request);
      const returnedId = response.headers.get("x-correlation-id");

      expect(returnedId).toBeTruthy();
      expect(returnedId).not.toBe(spoofedClientUuid);
      expect(returnedId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      );
    });
  });

  describe("Safe HTTP Methods Pass-Through & CSRF Issuance", () => {
    test("allows GET, HEAD, and OPTIONS and sets baseline security headers", () => {
      for (const method of ["GET", "HEAD", "OPTIONS"]) {
        const request = createRequest(method, "/");
        const response = proxy(request);

        expect(response.status).toBe(200);
        expect(response.headers.get("content-security-policy")).toBeTruthy();
        expect(response.headers.get("x-frame-options")).toBe("DENY");
        expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      }
    });

    test("issues fresh signed __Host-logos_csrf cookie on initial safe GET request when missing", () => {
      const request = createRequest("GET", "/");
      const response = proxy(request);

      expect(response.status).toBe(200);
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toBeTruthy();

      // Check mandatory cookie flags
      expect(setCookie).toContain("__Host-logos_csrf=");
      expect(setCookie).toContain("Path=/");
      expect(setCookie).toContain("SameSite=Strict");
      expect(setCookie).toContain("Secure");
      expect(setCookie).not.toContain("HttpOnly");
      expect(setCookie).not.toContain("Domain");

      // Extract token value and verify signature with CsrfProtection
      const match = setCookie?.match(/__Host-logos_csrf=([^;]+)/);
      expect(match).toBeTruthy();
      const token = match?.[1];
      expect(token).toBeTruthy();

      const verifyResult = csrf.verifyTokenString(token);
      expect(verifyResult).toEqual({ success: true });
    });

    test("preserves existing valid unexpired CSRF cookie without redundant Set-Cookie overwrite", () => {
      const validToken = csrf.generateToken();
      const request = createRequest("GET", "/", {
        cookies: {
          [CSRF_COOKIE_NAME]: validToken,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("set-cookie")).toBeNull();
    });

    test("refreshes and issues new signed cookie on safe request when incoming cookie is expired", () => {
      const pastTime = Date.now() - 7200000; // 2 hours ago
      const expiredCsrf = new CsrfProtection({
        secret: TEST_SECRET,
        maxAgeMs: 3600000,
        now: () => pastTime,
      });
      const expiredToken = expiredCsrf.generateToken(pastTime);

      const request = createRequest("GET", "/", {
        cookies: {
          [CSRF_COOKIE_NAME]: expiredToken,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(200);
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain("__Host-logos_csrf=");

      const match = setCookie?.match(/__Host-logos_csrf=([^;]+)/);
      const newToken = match?.[1];
      expect(newToken).not.toBe(expiredToken);
      expect(csrf.verifyTokenString(newToken)).toEqual({ success: true });
    });

    test("refreshes and issues new signed cookie on safe request when incoming cookie is tampered/invalid", () => {
      const request = createRequest("GET", "/", {
        cookies: {
          [CSRF_COOKIE_NAME]: "invalid.malformed.csrf.token.here",
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(200);
      const setCookie = response.headers.get("set-cookie");
      expect(setCookie).toBeTruthy();

      const match = setCookie?.match(/__Host-logos_csrf=([^;]+)/);
      const newToken = match?.[1];
      expect(csrf.verifyTokenString(newToken)).toEqual({ success: true });
    });
  });

  describe("Mutating Methods Origin Verification", () => {
    test("rejects mutating request without Origin or Referer with 403 envelope", async () => {
      const request = createRequest("POST", "/api/test");
      const response = proxy(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json).toEqual({
        error: {
          code: "FORBIDDEN_ORIGIN",
          message: "Request origin or anti-CSRF verification failed.",
          correlationId: expect.any(String),
        },
      });

      // Security headers preserved on rejection
      expect(response.headers.get("content-security-policy")).toBeTruthy();
      expect(response.headers.get("x-frame-options")).toBe("DENY");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-correlation-id")).toBe(
        json.error.correlationId,
      );
    });

    test("accepts mutating request with valid trusted Origin header", () => {
      const token = csrf.generateToken();
      const request = createRequest("POST", "/api/test", {
        headers: {
          origin: TEST_APP_URL,
          [CSRF_HEADER_NAME]: token,
        },
        cookies: {
          [CSRF_COOKIE_NAME]: token,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(200);
    });

    test("accepts mutating request when Origin is absent but Referer header contains trusted origin with path/query", () => {
      const token = csrf.generateToken();
      const request = createRequest("POST", "/api/test", {
        headers: {
          referer: `${TEST_APP_URL}/forms/submission?step=2&preview=true#submit-btn`,
          [CSRF_HEADER_NAME]: token,
        },
        cookies: {
          [CSRF_COOKIE_NAME]: token,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("x-correlation-id")).toBeTruthy();
    });

    test("rejects mutating request when Origin is absent and Referer is untrusted", async () => {
      const token = csrf.generateToken();
      const request = createRequest("POST", "/api/test", {
        headers: {
          referer: "https://evil.attacker.com/some/path",
          [CSRF_HEADER_NAME]: token,
        },
        cookies: {
          [CSRF_COOKIE_NAME]: token,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe("FORBIDDEN_ORIGIN");
    });

    test("rejects mutating request when Origin is absent and Referer contains userinfo", async () => {
      const token = csrf.generateToken();
      const request = createRequest("POST", "/api/test", {
        headers: {
          referer: `http://user:password@localhost:3000/api/test`,
          [CSRF_HEADER_NAME]: token,
        },
        cookies: {
          [CSRF_COOKIE_NAME]: token,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe("FORBIDDEN_ORIGIN");
    });

    test("rejects mutating request when Origin is absent and Referer is malformed", async () => {
      const token = csrf.generateToken();
      const request = createRequest("POST", "/api/test", {
        headers: {
          referer: "not-a-valid-url",
          [CSRF_HEADER_NAME]: token,
        },
        cookies: {
          [CSRF_COOKIE_NAME]: token,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe("FORBIDDEN_ORIGIN");
    });

    test("rejects mutating request with untrusted origin", async () => {
      const request = createRequest("POST", "/api/test", {
        headers: {
          origin: "https://attacker.evil.invalid",
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe("FORBIDDEN_ORIGIN");
    });

    test("rejects mutating request with spoofed Host / X-Forwarded-Host headers", async () => {
      const request = createRequest("POST", "/api/test", {
        headers: {
          origin: "https://attacker.evil.invalid",
          host: "localhost:3000",
          "x-forwarded-host": "localhost:3000",
          "x-forwarded-proto": "https",
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe("FORBIDDEN_ORIGIN");
    });

    test("rejects mutating request with malformed or oversized origin", async () => {
      const oversized =
        "https://" + "a".repeat(MAX_SECURITY_INPUT_LENGTH) + ".com";
      const request = createRequest("POST", "/api/test", {
        headers: {
          origin: oversized,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe("FORBIDDEN_ORIGIN");
    });
  });

  describe("Double-Submit Anti-CSRF Verification", () => {
    test("rejects mutating request when CSRF cookie is missing", async () => {
      const token = csrf.generateToken();
      const request = createRequest("POST", "/api/test", {
        headers: {
          origin: TEST_APP_URL,
          [CSRF_HEADER_NAME]: token,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe("FORBIDDEN_ORIGIN");
      expect(json.error.correlationId).toBe(
        response.headers.get("x-correlation-id"),
      );
    });

    test("rejects mutating request when CSRF header is missing", async () => {
      const token = csrf.generateToken();
      const request = createRequest("POST", "/api/test", {
        headers: {
          origin: TEST_APP_URL,
        },
        cookies: {
          [CSRF_COOKIE_NAME]: token,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe("FORBIDDEN_ORIGIN");
    });

    test("rejects mutating request when cookie and header tokens do not match", async () => {
      const tokenA = csrf.generateToken();
      const tokenB = csrf.generateToken();
      const request = createRequest("POST", "/api/test", {
        headers: {
          origin: TEST_APP_URL,
          [CSRF_HEADER_NAME]: tokenA,
        },
        cookies: {
          [CSRF_COOKIE_NAME]: tokenB,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe("FORBIDDEN_ORIGIN");
    });

    test("rejects mutating request with invalid or tampered CSRF token signature", async () => {
      const validToken = csrf.generateToken();
      const tamperedToken = validToken.slice(0, -4) + "bad!";
      const request = createRequest("POST", "/api/test", {
        headers: {
          origin: TEST_APP_URL,
          [CSRF_HEADER_NAME]: tamperedToken,
        },
        cookies: {
          [CSRF_COOKIE_NAME]: tamperedToken,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe("FORBIDDEN_ORIGIN");
    });

    test("succeeds for mutating request with trusted origin and matching signed CSRF token", () => {
      const token = csrf.generateToken();
      const request = createRequest("POST", "/api/test", {
        headers: {
          origin: TEST_APP_URL,
          [CSRF_HEADER_NAME]: token,
        },
        cookies: {
          [CSRF_COOKIE_NAME]: token,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("x-correlation-id")).toBeTruthy();
      expect(response.headers.get("content-security-policy")).toBeTruthy();
    });

    test("completes end-to-end flow: obtain token via safe GET, then echo in mutating POST", () => {
      // Step 1: Initial GET request arrives without CSRF cookie
      const getReq = createRequest("GET", "/");
      const getRes = proxy(getReq);
      expect(getRes.status).toBe(200);

      const setCookie = getRes.headers.get("set-cookie");
      expect(setCookie).toBeTruthy();
      const match = setCookie?.match(/__Host-logos_csrf=([^;]+)/);
      const issuedToken = match?.[1];
      expect(issuedToken).toBeTruthy();

      // Step 2: Client echoes issued cookie in cookie and X-CSRF-Token header
      const postReq = createRequest("POST", "/api/submit", {
        headers: {
          origin: TEST_APP_URL,
          [CSRF_HEADER_NAME]: issuedToken!,
        },
        cookies: {
          [CSRF_COOKIE_NAME]: issuedToken!,
        },
      });
      const postRes = proxy(postReq);
      expect(postRes.status).toBe(200);
      expect(postRes.headers.get("x-correlation-id")).toBeTruthy();
    });

    test("guards non-standard / unknown HTTP methods (e.g. PROPFIND, SEARCH, FOO)", async () => {
      for (const unknownMethod of ["PROPFIND", "SEARCH", "FOO"]) {
        const request = createRequest(unknownMethod, "/api/test", {
          headers: {
            origin: TEST_APP_URL,
          },
        });
        const response = proxy(request);

        expect(response.status).toBe(403);
        const json = await response.json();
        expect(json.error.code).toBe("FORBIDDEN_ORIGIN");
      }
    });
  });

  describe("Machine Path-Prefix Bypass Regression Defense", () => {
    test("does NOT allow blanket unauthenticated bypass for /api/webhooks* or /api/cron*", async () => {
      // In Phase 03, all mutating requests entering proxy require origin and CSRF validation.
      // Blanket path-only exemptions are eliminated to prevent unauthenticated bypass.
      for (const path of [
        "/api/webhooks/payment",
        "/api/webhooks",
        "/api/cron/cleanup",
        "/api/cron",
      ]) {
        const unauthenticatedRequest = createRequest("POST", path);
        const response = proxy(unauthenticatedRequest);

        expect(response.status).toBe(403);
        const json = await response.json();
        expect(json.error.code).toBe("FORBIDDEN_ORIGIN");
      }
    });
  });

  describe("Fail-Safe Misconfigured Environment Handling", () => {
    test("fails closed with 403 when no trusted origins are configured", async () => {
      process.env.APP_URL = "";
      process.env.TRUSTED_ORIGINS = "";

      const token = csrf.generateToken();
      const request = createRequest("POST", "/api/test", {
        headers: {
          origin: "http://localhost:3000",
          [CSRF_HEADER_NAME]: token,
        },
        cookies: {
          [CSRF_COOKIE_NAME]: token,
        },
      });
      const response = proxy(request);

      expect(response.status).toBe(403);
      const json = await response.json();
      expect(json.error.code).toBe("FORBIDDEN_ORIGIN");
    });

    test("fails closed with 500 envelope on mutating requests when CSRF secret is absent or <32 bytes", async () => {
      process.env.CSRF_SIGNING_SECRET = "too_short";

      // Mutating request fails closed with 500
      const mutatingReq = createRequest("POST", "/api/test", {
        headers: {
          origin: TEST_APP_URL,
        },
      });
      const mutatingRes = proxy(mutatingReq);
      expect(mutatingRes.status).toBe(500);
      const jsonMutating = await mutatingRes.json();
      expect(jsonMutating.error.code).toBe("INTERNAL_SERVER_ERROR");
      expect(mutatingRes.headers.get("x-correlation-id")).toBeTruthy();
      expect(mutatingRes.headers.get("content-security-policy")).toBeTruthy();

      // Safe request proceeds with baseline security headers without throwing
      const safeReq = createRequest("GET", "/");
      const safeRes = proxy(safeReq);
      expect(safeRes.status).toBe(200);
      expect(safeRes.headers.get("x-correlation-id")).toBeTruthy();
      expect(safeRes.headers.get("set-cookie")).toBeNull();
    });
  });
});

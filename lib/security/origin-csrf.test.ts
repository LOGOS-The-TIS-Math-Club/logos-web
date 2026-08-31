import { describe, expect, test } from "vitest";

import {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  CSRF_HEADER_NAME_CANONICAL,
  CSRF_RAW_TOKEN_BYTES,
  CSRF_TOKEN_VERSION,
  createCsrfCookieHeader,
  CsrfProtection,
  extractOriginFromReferer,
  isMutatingHttpMethod,
  isSafeHttpMethod,
  MAX_SECURITY_INPUT_LENGTH,
  MIN_CSRF_SECRET_BYTES,
  MUTATING_HTTP_METHODS,
  OriginVerifier,
  SAFE_HTTP_METHODS,
} from "./origin-csrf";

describe("Origin & Anti-CSRF Security Engine", () => {
  const VALID_32_BYTE_SECRET =
    "a_very_secure_and_random_32_byte_secret_1234567890!";
  const TEST_TRUSTED_ORIGIN = "https://example.com";
  const TEST_PREVIEW_ORIGIN = "https://preview-123.vercel.app";

  describe("HTTP Method Classification", () => {
    test("classifies GET, HEAD, and OPTIONS as safe/non-mutating", () => {
      for (const method of SAFE_HTTP_METHODS) {
        expect(isSafeHttpMethod(method)).toBe(true);
        expect(isSafeHttpMethod(method.toLowerCase())).toBe(true);
        expect(isMutatingHttpMethod(method)).toBe(false);
      }
    });

    test("classifies POST, PUT, PATCH, and DELETE as mutating", () => {
      for (const method of MUTATING_HTTP_METHODS) {
        expect(isMutatingHttpMethod(method)).toBe(true);
        expect(isMutatingHttpMethod(method.toLowerCase())).toBe(true);
        expect(isSafeHttpMethod(method)).toBe(false);
      }
    });

    test("handles whitespace and arbitrary strings", () => {
      expect(isSafeHttpMethod("  GET  ")).toBe(true);
      expect(isMutatingHttpMethod("  post  ")).toBe(true);
      expect(isSafeHttpMethod("CONNECT")).toBe(false);
      expect(isMutatingHttpMethod("TRACE")).toBe(false);
    });
  });

  describe("extractOriginFromReferer", () => {
    test("safely extracts canonical origin from valid full URLs", () => {
      expect(
        extractOriginFromReferer(
          "https://example.com/some/path?query=123#frag",
        ),
      ).toEqual({
        success: true,
        origin: "https://example.com",
      });

      expect(
        extractOriginFromReferer("http://localhost:3000/dashboard/settings"),
      ).toEqual({
        success: true,
        origin: "http://localhost:3000",
      });

      expect(
        extractOriginFromReferer("https://sub.domain.example.org:8443/"),
      ).toEqual({
        success: true,
        origin: "https://sub.domain.example.org:8443",
      });
    });

    test("rejects missing, undefined, null, or empty referer", () => {
      expect(extractOriginFromReferer(null)).toEqual({
        success: false,
        code: "ORIGIN_MISSING",
        reason: expect.any(String),
      });

      expect(extractOriginFromReferer(undefined)).toEqual({
        success: false,
        code: "ORIGIN_MISSING",
        reason: expect.any(String),
      });

      expect(extractOriginFromReferer("")).toEqual({
        success: false,
        code: "ORIGIN_MISSING",
        reason: expect.any(String),
      });

      expect(extractOriginFromReferer("   ")).toEqual({
        success: false,
        code: "ORIGIN_MISSING",
        reason: expect.any(String),
      });

      expect(extractOriginFromReferer("null")).toEqual({
        success: false,
        code: "ORIGIN_MISSING",
        reason: expect.any(String),
      });
    });

    test("rejects referer with userinfo / credentials", () => {
      const result = extractOriginFromReferer(
        "https://user:password@example.com/path",
      );
      expect(result).toEqual({
        success: false,
        code: "ORIGIN_HAS_USERINFO",
        reason: expect.stringContaining("userinfo"),
      });
    });

    test("rejects non-http / non-https schemes in referer", () => {
      const badSchemes = [
        "javascript:alert(1)",
        "data:text/html,evil",
        "file:///etc/passwd",
        "ftp://example.com/resource",
        "blob:https://example.com/123",
      ];

      for (const uri of badSchemes) {
        const result = extractOriginFromReferer(uri);
        expect(result).toEqual({
          success: false,
          code: "ORIGIN_MALFORMED",
          reason: expect.any(String),
        });
      }
    });

    test("rejects unparseable or malformed referer strings", () => {
      const malformed = [
        "not-a-valid-url",
        "://missing-scheme",
        "https://[invalid-ipv6",
      ];

      for (const uri of malformed) {
        const result = extractOriginFromReferer(uri);
        expect(result).toEqual({
          success: false,
          code: "ORIGIN_MALFORMED",
          reason: expect.any(String),
        });
      }
    });

    test("rejects referer strings exceeding MAX_SECURITY_INPUT_LENGTH", () => {
      const oversized =
        "https://example.com/" + "a".repeat(MAX_SECURITY_INPUT_LENGTH);
      const result = extractOriginFromReferer(oversized);
      expect(result).toEqual({
        success: false,
        code: "ORIGIN_MALFORMED",
        reason: expect.stringContaining("maximum allowed length"),
      });
    });
  });

  describe("OriginVerifier", () => {
    const verifier = new OriginVerifier({
      appUrl: TEST_TRUSTED_ORIGIN,
      trustedOrigins: [TEST_PREVIEW_ORIGIN, "http://localhost:3000"],
    });

    test("allows safe HTTP methods regardless of origin header value", () => {
      for (const method of ["GET", "HEAD", "OPTIONS"]) {
        expect(verifier.verifyOrigin(null, method)).toEqual({ success: true });
        expect(verifier.verifyOrigin(undefined, method)).toEqual({
          success: true,
        });
        expect(
          verifier.verifyOrigin("https://attacker.invalid", method),
        ).toEqual({ success: true });
      }
    });

    test("allows exact explicitly enumerated trusted origins for mutating methods", () => {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect(verifier.verifyOrigin(TEST_TRUSTED_ORIGIN, method)).toEqual({
          success: true,
        });
        expect(verifier.verifyOrigin(TEST_PREVIEW_ORIGIN, method)).toEqual({
          success: true,
        });
        expect(verifier.verifyOrigin("http://localhost:3000", method)).toEqual({
          success: true,
        });
      }
    });

    test("rejects missing, null, or whitespace origin on mutating methods", () => {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        expect(verifier.verifyOrigin(null, method)).toEqual({
          success: false,
          code: "ORIGIN_MISSING",
          reason: expect.any(String),
        });
        expect(verifier.verifyOrigin(undefined, method)).toEqual({
          success: false,
          code: "ORIGIN_MISSING",
          reason: expect.any(String),
        });
        expect(verifier.verifyOrigin("", method)).toEqual({
          success: false,
          code: "ORIGIN_MISSING",
          reason: expect.any(String),
        });
        expect(verifier.verifyOrigin("null", method)).toEqual({
          success: false,
          code: "ORIGIN_MISSING",
          reason: expect.any(String),
        });
      }
    });

    test("rejects wildcard / untrusted subdomain suffixes (e.g. *.vercel.app)", () => {
      const untrustedPreview = "https://unauthorized-branch.vercel.app";
      const result = verifier.verifyOrigin(untrustedPreview, "POST");
      expect(result).toEqual({
        success: false,
        code: "ORIGIN_UNTRUSTED",
        reason: expect.stringContaining(
          "not in the explicit trusted allowlist",
        ),
      });
    });

    test("rejects cross-origin untrusted attackers", () => {
      const attackerOrigins = [
        "https://evil.com",
        "https://attacker.example.com",
        "http://example.com", // Scheme mismatch (HTTP vs HTTPS)
        "https://example.com:8443", // Port mismatch
      ];

      for (const origin of attackerOrigins) {
        const res = verifier.verifyOrigin(origin, "POST");
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.code).toBe("ORIGIN_UNTRUSTED");
        }
      }
    });

    test("rejects malformed origin strings", () => {
      const malformed = [
        "not-a-url",
        "://invalid",
        "ftp://example.com",
        "javascript:void(0)",
      ];

      for (const bad of malformed) {
        const res = verifier.verifyOrigin(bad, "POST");
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.code).toBe("ORIGIN_MALFORMED");
        }
      }
    });

    test("rejects origins containing path components", () => {
      const result = verifier.verifyOrigin(
        "https://example.com/api/test",
        "POST",
      );
      expect(result).toEqual({
        success: false,
        code: "ORIGIN_HAS_PATH",
        reason: expect.stringContaining("path component"),
      });
    });

    test("rejects origins containing query parameters", () => {
      const result = verifier.verifyOrigin(
        "https://example.com?redirect=evil.com",
        "POST",
      );
      expect(result).toEqual({
        success: false,
        code: "ORIGIN_HAS_QUERY",
        reason: expect.stringContaining("query"),
      });
    });

    test("rejects origins containing fragment identifiers", () => {
      const result = verifier.verifyOrigin("https://example.com#token", "POST");
      expect(result).toEqual({
        success: false,
        code: "ORIGIN_HAS_FRAGMENT",
        reason: expect.stringContaining("fragment"),
      });
    });

    test("rejects origins containing userinfo / credentials", () => {
      const result = verifier.verifyOrigin(
        "https://user:pass@example.com",
        "POST",
      );
      expect(result).toEqual({
        success: false,
        code: "ORIGIN_HAS_USERINFO",
        reason: expect.stringContaining("userinfo"),
      });
    });

    test("fails closed when OriginVerifier has no trusted origins configured", () => {
      const emptyVerifier = new OriginVerifier({});
      expect(emptyVerifier.getAllowedOrigins().size).toBe(0);

      // Safe method passes
      expect(emptyVerifier.verifyOrigin("https://example.com", "GET")).toEqual({
        success: true,
      });

      // Mutating method fails closed with ORIGIN_UNTRUSTED
      const mutatingResult = emptyVerifier.verifyOrigin(
        "https://example.com",
        "POST",
      );
      expect(mutatingResult).toEqual({
        success: false,
        code: "ORIGIN_UNTRUSTED",
        reason: expect.stringContaining("No trusted origins configured"),
      });
    });

    test("rejects origin strings exceeding MAX_SECURITY_INPUT_LENGTH", () => {
      const oversizedOrigin =
        "https://" + "a".repeat(MAX_SECURITY_INPUT_LENGTH) + ".com";
      const result = verifier.verifyOrigin(oversizedOrigin, "POST");
      expect(result).toEqual({
        success: false,
        code: "ORIGIN_MALFORMED",
        reason: expect.stringContaining("maximum allowed length"),
      });
    });

    test("treats unknown non-safe HTTP methods as requiring origin validation", () => {
      for (const unknownMethod of [
        "TRACE",
        "CONNECT",
        "TRACK",
        "SEARCH",
        "FOO",
      ]) {
        const missingResult = verifier.verifyOrigin(null, unknownMethod);
        expect(missingResult).toEqual({
          success: false,
          code: "ORIGIN_MISSING",
          reason: expect.any(String),
        });

        const trustedResult = verifier.verifyOrigin(
          TEST_TRUSTED_ORIGIN,
          unknownMethod,
        );
        expect(trustedResult).toEqual({ success: true });
      }
    });

    describe("verifyRequestOrigin with Referer fallback", () => {
      test("uses Origin header directly when present", () => {
        const result = verifier.verifyRequestOrigin(
          TEST_TRUSTED_ORIGIN,
          "https://evil.com/ignored",
          "POST",
        );
        expect(result).toEqual({ success: true });
      });

      test("falls back to Referer origin when Origin header is absent", () => {
        const result = verifier.verifyRequestOrigin(
          undefined,
          "https://example.com/forms/contact?foo=1#bar",
          "POST",
        );
        expect(result).toEqual({ success: true });
      });

      test("falls back to Referer origin when Origin header is null or empty", () => {
        expect(
          verifier.verifyRequestOrigin(
            null,
            "https://preview-123.vercel.app/test/route",
            "POST",
          ),
        ).toEqual({ success: true });

        expect(
          verifier.verifyRequestOrigin(
            "",
            "http://localhost:3000/settings",
            "POST",
          ),
        ).toEqual({ success: true });
      });

      test("rejects mutating request when Origin is absent and Referer is untrusted", () => {
        const result = verifier.verifyRequestOrigin(
          null,
          "https://evil.attacker.com/some/path",
          "POST",
        );
        expect(result).toEqual({
          success: false,
          code: "ORIGIN_UNTRUSTED",
          reason: expect.stringContaining(
            "not in the explicit trusted allowlist",
          ),
        });
      });

      test("rejects mutating request when both Origin and Referer are absent", () => {
        const result = verifier.verifyRequestOrigin(null, null, "POST");
        expect(result).toEqual({
          success: false,
          code: "ORIGIN_MISSING",
          reason: expect.any(String),
        });
      });

      test("rejects mutating request when Origin is absent and Referer contains userinfo", () => {
        const result = verifier.verifyRequestOrigin(
          null,
          "https://user:pass@example.com/form",
          "POST",
        );
        expect(result).toEqual({
          success: false,
          code: "ORIGIN_HAS_USERINFO",
          reason: expect.stringContaining("userinfo"),
        });
      });

      test("rejects mutating request when Origin is absent and Referer is malformed", () => {
        const result = verifier.verifyRequestOrigin(null, "not-a-url", "POST");
        expect(result).toEqual({
          success: false,
          code: "ORIGIN_MALFORMED",
          reason: expect.any(String),
        });
      });

      test("allows safe HTTP methods regardless of absent Origin/Referer in verifyRequestOrigin", () => {
        for (const method of ["GET", "HEAD", "OPTIONS"]) {
          expect(verifier.verifyRequestOrigin(null, null, method)).toEqual({
            success: true,
          });
        }
      });
    });
  });

  describe("CsrfProtection Secret Requirements", () => {
    test("enforces minimum 32-byte secret requirement", () => {
      expect(MIN_CSRF_SECRET_BYTES).toBe(32);

      // Less than 32 bytes should throw
      expect(
        () => new CsrfProtection({ secret: "short_secret_under_32_bytes" }),
      ).toThrow(/at least 32 bytes/);

      // Exactly 32 bytes or more succeeds
      const exact32ByteSecret = "0".repeat(32);
      expect(exact32ByteSecret.length).toBe(32);
      expect(
        () => new CsrfProtection({ secret: exact32ByteSecret }),
      ).not.toThrow();

      // Buffer secret with >= 32 bytes succeeds
      expect(
        () => new CsrfProtection({ secret: Buffer.alloc(32, 1) }),
      ).not.toThrow();

      // Buffer secret with < 32 bytes throws
      expect(() => new CsrfProtection({ secret: Buffer.alloc(31, 1) })).toThrow(
        /at least 32 bytes/,
      );
    });
  });

  describe("CsrfProtection Token Lifecycle and Signature", () => {
    const fixedNow = 1756680000000; // Synthetic fixed timestamp
    const csrf = new CsrfProtection({
      secret: VALID_32_BYTE_SECRET,
      maxAgeMs: 60000, // 60 seconds
      now: () => fixedNow,
    });

    test("generates bounded, versioned token with 32 random bytes and HMAC signature", () => {
      const token = csrf.generateToken();
      expect(typeof token).toBe("string");

      const parts = token.split(".");
      expect(parts.length).toBe(5);

      const [version, issuedAtHex, expiresAtHex, randomHex, sigBase64Url] =
        parts;
      expect(version).toBe(CSRF_TOKEN_VERSION);
      expect(parseInt(issuedAtHex, 16)).toBe(fixedNow);
      expect(parseInt(expiresAtHex, 16)).toBe(fixedNow + 60000);
      expect(randomHex.length).toBe(CSRF_RAW_TOKEN_BYTES * 2);
      expect(Buffer.from(sigBase64Url, "base64url").length).toBe(32);
    });

    test("validates genuine unexpired token with matching signature", () => {
      const token = csrf.generateToken();
      const result = csrf.verifyTokenString(token);
      expect(result).toEqual({ success: true });
    });

    test("rejects expired token using injected time", () => {
      const token = csrf.generateToken(fixedNow);

      // Verify at future time past expiry (fixedNow + 60001)
      const result = csrf.verifyTokenString(token, fixedNow + 60001);
      expect(result).toEqual({
        success: false,
        code: "CSRF_TOKEN_EXPIRED",
        reason: expect.stringContaining("expired"),
      });
    });

    test("rejects token issued in the far future", () => {
      const token = csrf.generateToken(fixedNow + 10000); // 10s into future
      const result = csrf.verifyTokenString(token, fixedNow);

      expect(result).toEqual({
        success: false,
        code: "CSRF_TIMESTAMP_FUTURE",
        reason: expect.stringContaining("future"),
      });
    });

    test("rejects tampered token payload (modified expiry or random bytes)", () => {
      const token = csrf.generateToken();
      const parts = token.split(".");

      // Tamper with expiry
      const tamperedExpiry = [
        parts[0],
        parts[1],
        (parseInt(parts[2], 16) + 1000).toString(16),
        parts[3],
        parts[4],
      ].join(".");

      const resultExpiry = csrf.verifyTokenString(tamperedExpiry);
      expect(resultExpiry).toEqual({
        success: false,
        code: "CSRF_SIGNATURE_INVALID",
        reason: expect.any(String),
      });

      // Tamper with entropy part
      const flippedEntropy =
        parts[3].slice(0, -1) + (parts[3].slice(-1) === "a" ? "b" : "a");
      const tamperedEntropy = [
        parts[0],
        parts[1],
        parts[2],
        flippedEntropy,
        parts[4],
      ].join(".");

      const resultEntropy = csrf.verifyTokenString(tamperedEntropy);
      expect(resultEntropy).toEqual({
        success: false,
        code: "CSRF_SIGNATURE_INVALID",
        reason: expect.any(String),
      });
    });

    test("rejects token signed by a different secret", () => {
      const otherCsrf = new CsrfProtection({
        secret: "different_secret_that_is_at_least_32_bytes_long!",
        now: () => fixedNow,
      });

      const tokenFromOther = otherCsrf.generateToken();
      const result = csrf.verifyTokenString(tokenFromOther);

      expect(result).toEqual({
        success: false,
        code: "CSRF_SIGNATURE_INVALID",
        reason: expect.any(String),
      });
    });

    test("rejects malformed token strings without throwing exceptions", () => {
      const malformedCases: unknown[] = [
        null,
        undefined,
        "",
        "   ",
        "only.one.dot",
        "too.many.dots.in.the.middle.here.extra",
        "v2.1.2.3.4", // Unsupported version
        "v1.nothex.nothex.invalidentropy.invalidsig",
        12345,
        {},
      ];

      for (const item of malformedCases) {
        const res = csrf.verifyTokenString(item);
        expect(res.success).toBe(false);
        if (!res.success) {
          expect(res.code).toMatch(
            /CSRF_TOKEN_MALFORMED|CSRF_VERSION_UNSUPPORTED|CSRF_SIGNATURE_INVALID/,
          );
        }
      }
    });

    test("never leaks raw token or secret in failure reason", () => {
      const token = csrf.generateToken();
      const parts = token.split(".");
      const badToken = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}.badSignatureHere`;

      const result = csrf.verifyTokenString(badToken);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.reason).not.toContain(token);
        expect(result.reason).not.toContain(VALID_32_BYTE_SECRET);
        expect(result.reason).not.toContain(parts[3]); // Entropy not leaked
      }
    });
  });

  describe("CsrfProtection Double-Submit Verification", () => {
    const fixedNow = 1756680000000;
    const csrf = new CsrfProtection({
      secret: VALID_32_BYTE_SECRET,
      now: () => fixedNow,
    });

    test("safe methods (GET, HEAD, OPTIONS) bypass CSRF checks without tokens", () => {
      for (const method of ["GET", "HEAD", "OPTIONS"]) {
        expect(csrf.verifyDoubleSubmit(null, null, method)).toEqual({
          success: true,
        });
        expect(csrf.verifyDoubleSubmit(undefined, undefined, method)).toEqual({
          success: true,
        });
      }
    });

    test("mutating methods succeed when cookie and header match valid signed token", () => {
      const validToken = csrf.generateToken();

      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        const result = csrf.verifyDoubleSubmit(
          validToken,
          validToken,
          method,
          fixedNow,
        );
        expect(result).toEqual({ success: true });
      }
    });

    test("fails closed when cookie token is missing for mutating requests", () => {
      const validToken = csrf.generateToken();
      const result = csrf.verifyDoubleSubmit(null, validToken, "POST");

      expect(result).toEqual({
        success: false,
        code: "CSRF_COOKIE_MISSING",
        reason: expect.any(String),
      });
    });

    test("fails closed when header token is missing for mutating requests", () => {
      const validToken = csrf.generateToken();
      const result = csrf.verifyDoubleSubmit(validToken, null, "POST");

      expect(result).toEqual({
        success: false,
        code: "CSRF_HEADER_MISSING",
        reason: expect.any(String),
      });
    });

    test("fails closed when cookie and header tokens do not match", () => {
      const tokenA = csrf.generateToken();
      const tokenB = csrf.generateToken();

      const result = csrf.verifyDoubleSubmit(tokenA, tokenB, "POST");
      expect(result).toEqual({
        success: false,
        code: "CSRF_TOKEN_MISMATCH",
        reason: expect.any(String),
      });
    });

    test("fails closed when CSRF tokens exceed MAX_SECURITY_INPUT_LENGTH", () => {
      const oversizedToken = "v1." + "a".repeat(MAX_SECURITY_INPUT_LENGTH);
      const verifyStringResult = csrf.verifyTokenString(oversizedToken);
      expect(verifyStringResult).toEqual({
        success: false,
        code: "CSRF_TOKEN_MALFORMED",
        reason: expect.stringContaining("maximum allowed length"),
      });

      const doubleSubmitResult = csrf.verifyDoubleSubmit(
        oversizedToken,
        oversizedToken,
        "POST",
      );
      expect(doubleSubmitResult).toEqual({
        success: false,
        code: "CSRF_TOKEN_MALFORMED",
        reason: expect.stringContaining("maximum allowed length"),
      });
    });

    test("guards unknown HTTP methods under CSRF validation", () => {
      const validToken = csrf.generateToken();

      for (const unknownMethod of [
        "TRACE",
        "CONNECT",
        "TRACK",
        "SEARCH",
        "FOO",
      ]) {
        // Missing tokens fail closed
        const missingResult = csrf.verifyDoubleSubmit(
          null,
          null,
          unknownMethod,
        );
        expect(missingResult.success).toBe(false);

        // Valid tokens succeed
        const validResult = csrf.verifyDoubleSubmit(
          validToken,
          validToken,
          unknownMethod,
          fixedNow,
        );
        expect(validResult).toEqual({ success: true });
      }
    });

    test("verifies constant exported names match architecture spec", () => {
      expect(CSRF_COOKIE_NAME).toBe("__Host-logos_csrf");
      expect(CSRF_HEADER_NAME).toBe("x-csrf-token");
      expect(CSRF_HEADER_NAME_CANONICAL).toBe("X-CSRF-Token");
    });
  });

  describe("createCsrfCookieHeader", () => {
    test("creates compliant __Host- cookie header with all mandatory invariant flags", () => {
      const token = "sample-csrf-token-value";
      const header = createCsrfCookieHeader(token);

      expect(header).toBe(
        "__Host-logos_csrf=sample-csrf-token-value; Path=/; SameSite=Strict; Max-Age=3600; Secure",
      );
      expect(header).toContain("__Host-logos_csrf=sample-csrf-token-value");
      expect(header).toContain("Path=/");
      expect(header).toContain("SameSite=Strict");
      expect(header).toContain("Secure");
      expect(header).toContain("Max-Age=3600");
      // Must NOT be HttpOnly so client JS can read it to echo into X-CSRF-Token
      expect(header).not.toContain("HttpOnly");
      // Must NOT contain Domain attribute (__Host- invariant)
      expect(header).not.toContain("Domain");
    });

    test("supports custom valid maxAgeSeconds while strictly preserving mandatory security flags", () => {
      const token = "sample-custom-token";
      const header = createCsrfCookieHeader(token, {
        maxAgeSeconds: 1800,
      });

      expect(header).toBe(
        "__Host-logos_csrf=sample-custom-token; Path=/; SameSite=Strict; Max-Age=1800; Secure",
      );
      expect(header).toContain("SameSite=Strict");
      expect(header).toContain("Secure");
      expect(header).toContain("Path=/");
      expect(header).not.toContain("Domain");
      expect(header).not.toContain("HttpOnly");
    });

    test("validates token input and rejects empty, non-string, or oversized tokens", () => {
      expect(() => createCsrfCookieHeader("")).toThrow(
        /Invalid CSRF token for cookie header generation/,
      );
      expect(() => createCsrfCookieHeader("   ")).toThrow(
        /Invalid CSRF token for cookie header generation/,
      );
      expect(() => createCsrfCookieHeader(null as unknown as string)).toThrow(
        /Invalid CSRF token for cookie header generation/,
      );
      expect(() =>
        createCsrfCookieHeader("a".repeat(MAX_SECURITY_INPUT_LENGTH + 1)),
      ).toThrow(/Invalid CSRF token for cookie header generation/);
    });
  });
});

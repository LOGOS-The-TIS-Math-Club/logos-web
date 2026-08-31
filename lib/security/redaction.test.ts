import { describe, expect, it } from "vitest";

import {
  deepFreeze,
  isSensitiveKey,
  REDACTION_PLACEHOLDERS,
  sanitizeAllowedObject,
  sanitizeString,
} from "./redaction";

describe("Strict Redaction & Sanitization Engine", () => {
  describe("Explicit Allowlist Construction & Sensitive Key Dropping", () => {
    it("retains only explicit allowed keys and drops unknown keys", () => {
      const input = {
        id: "probe-100",
        status: "active",
        metadata: "internal-data",
        internalPointer: "0xdeadbeef",
      };
      const result = sanitizeAllowedObject(input, ["id", "status"]);
      expect(result).toEqual({ id: "probe-100", status: "active" });
      expect(result).not.toHaveProperty("metadata");
      expect(result).not.toHaveProperty("internalPointer");
    });

    it("unconditionally drops sensitive keys even when explicitly listed in allowedKeys", () => {
      const input = {
        id: "probe-101",
        body: "{ bad: 1 }",
        headers: "Authorization: Bearer token",
        cookie: "sess=123",
        authorization: "secret-auth",
        token: "tok-abc",
        password: "p@ssword",
        secret: "super-secret",
        query: "select=1",
        url: "https://db.com",
        email: "user@school.edu",
        name: "Alice",
        absence: "sick",
        form: "data",
        providerPayload: { a: 1 },
      };
      const allKeys = Object.keys(input);
      const result = sanitizeAllowedObject(input, allKeys);
      expect(result).toEqual({ id: "probe-101" });
      for (const k of allKeys.filter((k) => k !== "id")) {
        expect(result).not.toHaveProperty(k);
      }
    });

    it("handles nested mixed casing and normalizes property key matching", () => {
      const input = {
        TargetType: "probe_record",
        target_id: "probe-456",
        METADATA_VALUE: "safe_value",
      };
      const result = sanitizeAllowedObject(input, [
        "targetType",
        "targetId",
        "metadataValue",
      ]);
      expect(result).toHaveProperty("TargetType", "probe_record");
      expect(result).toHaveProperty("target_id", "probe-456");
      expect(result).toHaveProperty("METADATA_VALUE", "safe_value");
    });

    it("identifies sensitive keys with isSensitiveKey", () => {
      expect(isSensitiveKey("password")).toBe(true);
      expect(isSensitiveKey("USER_PASSWORD")).toBe(true);
      expect(isSensitiveKey("providerPayload")).toBe(true);
      expect(isSensitiveKey("studentName")).toBe(true);
      expect(isSensitiveKey("absenceReason")).toBe(true);
      expect(isSensitiveKey("requestHeaders")).toBe(true);
      expect(isSensitiveKey("id")).toBe(false);
      expect(isSensitiveKey("status")).toBe(false);
      expect(isSensitiveKey("action")).toBe(false);
    });
  });

  describe("String Scrubbing (Defense-in-Depth)", () => {
    it("redacts postgres and postgresql database URLs", () => {
      const s1 =
        "Error: postgresql://admin:secretPass@db.internal:5432/logos_db";
      const s2 =
        "DATABASE_URL=postgres://neon_u:neon_p@ep-cool.aws.neon.tech/neondb";
      expect(sanitizeString(s1)).toBe(`Error: ${REDACTION_PLACEHOLDERS.dbUrl}`);
      expect(sanitizeString(s2)).toContain(REDACTION_PLACEHOLDERS.dbUrl);
      expect(sanitizeString(s2)).not.toContain("neon_p");
    });

    it("removes generic URL userinfo credentials and query strings entirely", () => {
      const urlWithCreds =
        "Connecting to https://operator_user:my_secret_token@api.service.internal/v1/res";
      const scrubbedCreds = sanitizeString(urlWithCreds);
      expect(scrubbedCreds).toBe(
        "Connecting to https://api.service.internal/v1/res",
      );
      expect(scrubbedCreds).not.toContain("operator_user");
      expect(scrubbedCreds).not.toContain("my_secret_token");

      const urlWithQuery =
        "GET https://auth.provider.com/callback?code=oauth_auth_code_12345&state=xyz987";
      const scrubbedQuery = sanitizeString(urlWithQuery);
      expect(scrubbedQuery).toBe("GET https://auth.provider.com/callback");
      expect(scrubbedQuery).not.toContain("oauth_auth_code_12345");
      expect(scrubbedQuery).not.toContain("?");
    });

    it("redacts bearer tokens, JWTs, API keys, and OAuth tokens", () => {
      const jwtHeader = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" }),
      ).toString("base64url");
      const jwtPayload = Buffer.from(
        JSON.stringify({ sub: "1234567890" }),
      ).toString("base64url");
      const jwtSignature = "inert_jwt_signature_segment_12345";
      const jwt = `${jwtHeader}.${jwtPayload}.${jwtSignature}`;
      expect(sanitizeString(`Bearer ${jwt}`)).toContain(
        REDACTION_PLACEHOLDERS.token,
      );
      expect(sanitizeString(jwt)).toBe(REDACTION_PLACEHOLDERS.jwt);
      expect(
        sanitizeString("apiKey: inert_mock_api_key_sample_12345"),
      ).toContain(REDACTION_PLACEHOLDERS.token);
      expect(
        sanitizeString("access_token = inert_mock_oauth_token_12345"),
      ).toContain(REDACTION_PLACEHOLDERS.token);
      expect(
        sanitizeString("token prefix sec_inertTokenFixture123456789"),
      ).toContain(REDACTION_PLACEHOLDERS.token);
    });

    it("redacts emails, names, absence reasons, and form content", () => {
      expect(sanitizeString("Contact student.leader-99@school.edu")).toBe(
        `Contact ${REDACTION_PLACEHOLDERS.email}`,
      );
      expect(sanitizeString("student_name: Alice Smith")).toBe(
        `student_name: ${REDACTION_PLACEHOLDERS.name}`,
      );
      expect(sanitizeString("teacher-name: Jonathan Doe")).toBe(
        `teacher-name: ${REDACTION_PLACEHOLDERS.name}`,
      );
      expect(sanitizeString("absence_reason: Flu diagnosis")).toBe(
        `absence_reason: ${REDACTION_PLACEHOLDERS.absence}`,
      );
      expect(sanitizeString("form_content: Requesting funding")).toBe(
        `form_content: ${REDACTION_PLACEHOLDERS.form}`,
      );
    });
  });

  describe("Error, Date, and URL Handling", () => {
    it("handles Error objects and scrubs messages", () => {
      const err = new Error("Failed postgresql://admin:p@db:5432/prod");
      (err as Error & { code?: string }).code = "ETIMEDOUT";
      const sanitized = sanitizeAllowedObject(err, ["name", "message", "code"]);
      expect(sanitized).toEqual({
        name: "Error",
        message: `Failed ${REDACTION_PLACEHOLDERS.dbUrl}`,
        code: "ETIMEDOUT",
      });
      expect(Object.isFrozen(sanitized)).toBe(true);
    });

    it("handles Date objects (valid ISO and invalid)", () => {
      const validDate = new Date("2026-08-31T20:30:00.000Z");
      const invalidDate = new Date("invalid");
      const result = sanitizeAllowedObject(
        { valid: validDate, invalid: invalidDate },
        ["valid", "invalid"],
      );
      expect(result.valid).toBe("2026-08-31T20:30:00.000Z");
      expect(result.invalid).toBe(REDACTION_PLACEHOLDERS.invalidDate);
    });

    it("handles URL objects removing credentials and queries or redacting postgres", () => {
      const httpUrl = new URL(
        "https://user:pass@example.com/api?token=secret123#hash",
      );
      const pgUrl = new URL(
        "postgresql://admin:secret@host.internal:5432/logos",
      );
      const res = sanitizeAllowedObject({ http: httpUrl, pg: pgUrl }, [
        "http",
        "pg",
      ]);
      expect(res.http).toBe("https://example.com/api#hash");
      expect(res.pg).toBe(REDACTION_PLACEHOLDERS.dbUrl);
    });
  });

  describe("Circular Structures & Throwing Getters", () => {
    it("handles circular references gracefully without stack overflow", () => {
      interface Node {
        id: string;
        next?: Node;
      }
      const a: Node = { id: "node-a" };
      const b: Node = { id: "node-b", next: a };
      a.next = b;
      const res = sanitizeAllowedObject<Node>(a, ["id", "next"]);
      expect(res.id).toBe("node-a");
      expect(res.next?.id).toBe("node-b");
      expect(res.next?.next as unknown).toBe(REDACTION_PLACEHOLDERS.circular);
    });

    it("handles throwing getters safely without throwing", () => {
      const obj = {
        id: "safe-id",
        get exploded(): string {
          throw new Error("Boom");
        },
      };
      let res: Record<string, unknown> = {};
      expect(() => {
        res = sanitizeAllowedObject(obj, ["id", "exploded"]);
      }).not.toThrow();
      expect(res.id).toBe("safe-id");
      expect(res.exploded).toBe(REDACTION_PLACEHOLDERS.unreadable);
    });
  });

  describe("Bounds Enforcement", () => {
    it("enforces maxStringLength and appends truncated placeholder", () => {
      const str = "A".repeat(50);
      const res = sanitizeString(str, { maxStringLength: 20 });
      expect(res.length).toBe(20);
      expect(res.endsWith(REDACTION_PLACEHOLDERS.truncated)).toBe(true);
    });

    it("enforces maxArrayLength slicing excessive elements", () => {
      const arr = Array.from({ length: 15 }, (_, i) => `item-${i}`);
      const res = sanitizeAllowedObject({ items: arr }, ["items"], {
        maxArrayLength: 5,
      });
      expect((res.items as unknown[]).length).toBe(5);
      expect((res.items as unknown[])[4]).toBe("item-4");
    });

    it("enforces maxKeys limiting retained properties", () => {
      const obj: Record<string, number> = {};
      for (let i = 0; i < 20; i++) obj[`k${i}`] = i;
      const res = sanitizeAllowedObject(obj, Object.keys(obj), { maxKeys: 4 });
      expect(Object.keys(res).length).toBe(4);
    });

    it("enforces maxDepth semantics: scalar keys on depth-2 object remain, only deeper child values become [MAX_DEPTH]", () => {
      const nested = {
        id: "root-0",
        child1: {
          id: "child-1",
          child2: {
            id: "child-2",
            deepChild3: { id: "child-3" },
          },
        },
      };
      // root is depth 0. child1 is at depth 1. child2 is at depth 2.
      // With maxDepth: 2, scalar keys on child2 (depth 2) like child2.id remain.
      // But deeper child values of child2 (like deepChild3) become [MAX_DEPTH].
      const res = sanitizeAllowedObject<Record<string, unknown>>(
        nested,
        ["id", "child1", "child2", "deepChild3"],
        { maxDepth: 2 },
      );
      expect(res.id).toBe("root-0");
      const c1 = res.child1 as Record<string, unknown>;
      expect(c1.id).toBe("child-1");
      const c2 = c1.child2 as Record<string, unknown>;
      expect(c2.id).toBe("child-2");
      expect(c2.deepChild3).toBe(REDACTION_PLACEHOLDERS.maxDepth);
    });

    it("enforces maxSerializedBytes bounding JSON budget", () => {
      const obj = { id: "id-1", marker: "X".repeat(500) };
      const res = sanitizeAllowedObject(obj, ["id", "marker"], {
        maxSerializedBytes: 40,
      });
      const serialized = JSON.stringify(res);
      expect(Buffer.byteLength(serialized, "utf8")).toBeLessThanOrEqual(40);
    });
  });

  describe("Deep Immutability", () => {
    it("returns deeply frozen objects and arrays", () => {
      const obj = { id: "test", list: [{ val: 1 }, { val: 2 }] };
      const res = sanitizeAllowedObject(obj, ["id", "list", "val"]);
      expect(Object.isFrozen(res)).toBe(true);
      expect(Object.isFrozen(res.list)).toBe(true);
      expect(Object.isFrozen((res.list as Record<string, unknown>[])[0])).toBe(
        true,
      );
      expect(() => {
        (res as Record<string, unknown>).id = "change";
      }).toThrow();
    });

    it("handles primitives in deepFreeze safely", () => {
      expect(deepFreeze(null)).toBe(null);
      expect(deepFreeze(undefined)).toBe(undefined);
      expect(deepFreeze("abc")).toBe("abc");
      expect(deepFreeze(123)).toBe(123);
    });
  });
});

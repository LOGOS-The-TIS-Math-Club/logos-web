import { describe, expect, test } from "vitest";

import {
  hashSubject,
  MIN_RATE_LIMIT_SECRET_BYTES,
  SubjectHasher,
} from "./hasher";

describe("HMAC-SHA-256 Subject Hasher with Purpose Salts", () => {
  const VALID_SECRET = "a_super_secret_rate_limit_key_of_32_bytes_len!";
  const TEST_IP = "192.0.2.42";

  test("requires minimum 32-byte secret key", () => {
    expect(MIN_RATE_LIMIT_SECRET_BYTES).toBe(32);
    expect(() => new SubjectHasher({ secret: "short_secret" })).toThrow(
      /at least 32 bytes/,
    );
  });

  test("computes deterministic 64-character lowercase hex hash", () => {
    const hasher = new SubjectHasher({ secret: VALID_SECRET });
    const hash1 = hasher.hashSubject("form_submission", TEST_IP);
    const hash2 = hasher.hashSubject("form_submission", TEST_IP);

    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  test("isolates contexts via purpose salts (same identifier produces different hashes)", () => {
    const hasher = new SubjectHasher({ secret: VALID_SECRET });
    const authHash = hasher.hashSubject("auth_attempt", TEST_IP);
    const formHash = hasher.hashSubject("form_submission", TEST_IP);
    const synthHash = hasher.hashSubject("synthetic_test", TEST_IP);

    expect(authHash).not.toBe(formHash);
    expect(authHash).not.toBe(synthHash);
    expect(formHash).not.toBe(synthHash);
  });

  test("different identifiers produce different hashes for same purpose", () => {
    const hasher = new SubjectHasher({ secret: VALID_SECRET });
    const hashA = hasher.hashSubject("form_submission", "192.0.2.1");
    const hashB = hasher.hashSubject("form_submission", "192.0.2.2");

    expect(hashA).not.toBe(hashB);
  });

  test("rejects empty purpose or empty identifier", () => {
    const hasher = new SubjectHasher({ secret: VALID_SECRET });
    expect(() => hasher.hashSubject("", TEST_IP)).toThrow(
      /purpose must be a non-empty string/,
    );
    expect(() => hasher.hashSubject("   ", TEST_IP)).toThrow(
      /purpose must be a non-empty string/,
    );
    expect(() => hasher.hashSubject("auth", "")).toThrow(
      /identifier must be a non-empty string/,
    );
    expect(() => hasher.hashSubject("auth", "   ")).toThrow(
      /identifier must be a non-empty string/,
    );
  });

  test("standalone hashSubject function matches SubjectHasher class", () => {
    const hasher = new SubjectHasher({ secret: VALID_SECRET });
    const classHash = hasher.hashSubject("api_call", "user-123");
    const fnHash = hashSubject(VALID_SECRET, "api_call", "user-123");

    expect(fnHash).toBe(classHash);
  });
});

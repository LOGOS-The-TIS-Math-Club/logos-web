import { describe, expect, it } from "vitest";
import { createSessionCsrfToken, verifySessionCsrfToken } from "./session-csrf";

const secret = "s".repeat(32);

describe("session-bound anti-CSRF tokens", () => {
  it("accepts the exact token for the issuing session", () => {
    const token = createSessionCsrfToken(secret, "session-a");
    expect(verifySessionCsrfToken(secret, "session-a", token, token)).toBe(
      true,
    );
  });

  it("rejects session mismatch, replay, and header mismatch", () => {
    const token = createSessionCsrfToken(secret, "session-a", 1_000);
    expect(
      verifySessionCsrfToken(secret, "session-b", token, token, 2_000),
    ).toBe(false);
    expect(
      verifySessionCsrfToken(secret, "session-a", token, `${token}x`, 2_000),
    ).toBe(false);
    expect(
      verifySessionCsrfToken(secret, "session-a", token, token, 3_602_000),
    ).toBe(false);
  });
});

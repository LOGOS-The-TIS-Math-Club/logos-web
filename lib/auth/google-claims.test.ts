// @vitest-environment node

import { generateKeyPair, SignJWT } from "jose";
import { beforeAll, describe, expect, it } from "vitest";
import {
  normalizeVerifiedGoogleClaims,
  verifyGoogleIdTokenWithKey,
} from "./google-claims.server";

const base = {
  sub: "google-subject-1",
  email: "Synthetic.User@TOKYOIS.COM",
  email_verified: true,
};

describe("Google identity claims", () => {
  let privateKey: CryptoKey;
  let publicKey: CryptoKey;

  beforeAll(async () => {
    ({ privateKey, publicKey } = await generateKeyPair("RS256"));
  });

  it("normalizes signed identity evidence", () => {
    expect(
      normalizeVerifiedGoogleClaims({ ...base, hd: "TOKYOIS.COM" }),
    ).toEqual({
      subject: "google-subject-1",
      email: "synthetic.user@tokyois.com",
      hostedDomain: "tokyois.com",
    });
  });

  it("keeps a missing hosted domain pending-capable", () => {
    expect(normalizeVerifiedGoogleClaims(base).hostedDomain).toBeNull();
  });

  it("rejects unverified email and malformed evidence", () => {
    expect(() =>
      normalizeVerifiedGoogleClaims({ ...base, email_verified: false }),
    ).toThrow();
    expect(() => normalizeVerifiedGoogleClaims({ ...base, sub: "" })).toThrow();
  });

  it("verifies issuer, audience, expiry, and signature on synthetic tokens", async () => {
    const token = await new SignJWT({ ...base, hd: "tokyois.com" })
      .setProtectedHeader({ alg: "RS256", kid: "phase04-test-only" })
      .setIssuer("https://accounts.google.com")
      .setAudience("synthetic-client-id")
      .setIssuedAt()
      .setExpirationTime("5m")
      .sign(privateKey);

    await expect(
      verifyGoogleIdTokenWithKey(token, "synthetic-client-id", publicKey),
    ).resolves.toMatchObject({
      subject: "google-subject-1",
      hostedDomain: "tokyois.com",
    });
    await expect(
      verifyGoogleIdTokenWithKey(
        token,
        ["other-id", "synthetic-client-id"],
        publicKey,
      ),
    ).resolves.toMatchObject({
      subject: "google-subject-1",
      hostedDomain: "tokyois.com",
    });
    await expect(
      verifyGoogleIdTokenWithKey(token, "wrong-client-id", publicKey),
    ).rejects.toThrow();
  });
});

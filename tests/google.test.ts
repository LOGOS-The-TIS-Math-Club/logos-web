import assert from "node:assert/strict";
import { test } from "node:test";
import { generateKeyPair, SignJWT } from "jose";
import { ZodError } from "zod";
import { verifyGoogleTokenWithKey } from "../src/auth/google.ts";

const audience = "test-google-client-id";
const issuer = "https://accounts.google.com";
const { privateKey, publicKey } = await generateKeyPair("RS256");

async function signedToken(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuer,
    aud: audience,
    sub: "google-subject-123",
    email: "student@tokyois.com",
    email_verified: true,
    hd: "tokyois.com",
    iat: now,
    exp: now + 300,
    ...overrides,
  };
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256" })
    .sign(privateKey);
}

test("verifies a locally signed Google school claim with the expected audience", async () => {
  const claims = await verifyGoogleTokenWithKey(
    await signedToken(),
    audience,
    publicKey,
  );
  assert.equal(claims.sub, "google-subject-123");
  assert.equal(claims.email, "student@tokyois.com");
});

test("rejects wrong audience, issuer, and expired tokens", async () => {
  await assert.rejects(
    verifyGoogleTokenWithKey(
      await signedToken({ aud: "other-client" }),
      audience,
      publicKey,
    ),
  );
  await assert.rejects(
    verifyGoogleTokenWithKey(
      await signedToken({ iss: "https://attacker.invalid" }),
      audience,
      publicKey,
    ),
  );
  const expired = await signedToken({
    exp: Math.floor(Date.now() / 1000) - 60,
  });
  await assert.rejects(verifyGoogleTokenWithKey(expired, audience, publicKey));
});

test("rejects school claim payloads with unverified email, bad hosted domain, or mismatched email domain", async () => {
  for (const overrides of [
    { email_verified: false },
    { hd: "example.com" },
    { email: "student@example.com" },
  ]) {
    const token = await signedToken(overrides);
    await assert.rejects(
      verifyGoogleTokenWithKey(token, audience, publicKey),
      (error: unknown) => error instanceof ZodError,
    );
  }
});

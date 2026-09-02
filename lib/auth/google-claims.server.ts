import "server-only";

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { z } from "zod";

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

const GoogleClaimsSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.string().email().max(320),
  email_verified: z.literal(true),
  hd: z.string().min(1).max(253).optional(),
});

export function normalizeVerifiedGoogleClaims(
  payload: unknown,
): VerifiedGoogleClaims {
  const claims = GoogleClaimsSchema.parse(payload);
  return {
    subject: claims.sub,
    email: claims.email.toLowerCase(),
    hostedDomain: claims.hd?.toLowerCase() ?? null,
  };
}

export type VerifiedGoogleClaims = {
  subject: string;
  email: string;
  hostedDomain: string | null;
};

export const NEON_DEFAULT_GOOGLE_CLIENT_ID =
  "516759701042-1j43chkqtgl8hf49j0cql8gf34sun3e9.apps.googleusercontent.com";

export async function verifyGoogleIdToken(
  idToken: string,
  audience?: string | string[],
): Promise<VerifiedGoogleClaims> {
  const customAudience = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const allowedAudiences = Array.from(
    new Set(
      [
        ...(audience ? (Array.isArray(audience) ? audience : [audience]) : []),
        ...(customAudience ? [customAudience] : []),
        NEON_DEFAULT_GOOGLE_CLIENT_ID,
      ].filter(Boolean),
    ),
  );

  if (allowedAudiences.length === 0) {
    throw new Error("Google OAuth audience is not configured");
  }

  return verifyGoogleIdTokenWithKey(idToken, allowedAudiences, googleKeys);
}

export async function verifyGoogleIdTokenWithKey(
  idToken: string,
  audience: string | string[],
  key: CryptoKey | Uint8Array | JWTVerifyGetKey,
): Promise<VerifiedGoogleClaims> {
  const { payload } = await jwtVerify(idToken, key, {
    audience,
    issuer: GOOGLE_ISSUERS,
    algorithms: ["RS256"],
  });
  return normalizeVerifiedGoogleClaims(payload);
}

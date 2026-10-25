import { createRemoteJWKSet, jwtVerify } from "jose";
import { z } from "zod";
const keys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);
export const googleClaims = z
  .object({
    sub: z.string().min(1).max(255),
    email: z.email().max(320),
    email_verified: z.literal(true),
    hd: z.literal("tokyois.com"),
  })
  .refine(
    (v) => /^[^@\s]+@tokyois\.com$/i.test(v.email),
    "A verified school Google account is required",
  );
export async function verifyGoogleTokenWithKey(
  token: string,
  audience: string,
  key: Parameters<typeof jwtVerify>[1],
) {
  const { payload } = await jwtVerify(token, key, {
    algorithms: ["RS256"],
    issuer: ["https://accounts.google.com", "accounts.google.com"],
    audience,
  });
  return googleClaims.parse(payload);
}

export async function verifyGoogleToken(token: string, audience: string) {
  return verifyGoogleTokenWithKey(token, audience, keys);
}

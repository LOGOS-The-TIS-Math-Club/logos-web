import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_CSRF_COOKIE_NAME = "__Host-logos_session_csrf";
export const SESSION_CSRF_HEADER_NAME = "x-session-csrf-token";
const SESSION_CSRF_MAX_AGE_MS = 60 * 60 * 1000;

function signature(
  secret: string,
  sessionId: string,
  nonce: string,
  expiresAtHex: string,
) {
  return createHmac("sha256", secret)
    .update(`${sessionId}.${nonce}.${expiresAtHex}`, "utf8")
    .digest();
}

export function createSessionCsrfToken(
  secret: string,
  sessionId: string,
  now = Date.now(),
): string {
  const nonce = randomBytes(32).toString("base64url");
  const expiresAtHex = (now + SESSION_CSRF_MAX_AGE_MS).toString(16);
  return `${nonce}.${expiresAtHex}.${signature(secret, sessionId, nonce, expiresAtHex).toString("base64url")}`;
}

export function verifySessionCsrfToken(
  secret: string,
  sessionId: string,
  cookieToken: string | undefined,
  headerToken: string | null,
  now = Date.now(),
): boolean {
  if (
    !cookieToken ||
    !headerToken ||
    cookieToken !== headerToken ||
    cookieToken.length > 256
  ) {
    return false;
  }
  const [nonce, expiresAtHex, encodedSignature, extra] = cookieToken.split(".");
  if (!nonce || !expiresAtHex || !encodedSignature || extra) return false;
  try {
    const expiresAt = Number.parseInt(expiresAtHex, 16);
    if (!Number.isFinite(expiresAt) || now > expiresAt) return false;
    const supplied = Buffer.from(encodedSignature, "base64url");
    const expected = signature(secret, sessionId, nonce, expiresAtHex);
    return (
      supplied.length === expected.length && timingSafeEqual(supplied, expected)
    );
  } catch {
    return false;
  }
}

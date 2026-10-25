import { createNeonAuth } from "@neondatabase/auth/next/server";
import { BackendError } from "../server/errors.ts";
let instance: ReturnType<typeof createNeonAuth> | undefined;
export function getAuth() {
  if (!instance) {
    const baseUrl = process.env.NEON_AUTH_BASE_URL;
    const secret = process.env.NEON_AUTH_COOKIE_SECRET;
    if (
      !baseUrl ||
      !secret ||
      secret.length < 32 ||
      new URL(baseUrl).protocol !== "https:"
    )
      throw new BackendError(
        "UNAVAILABLE",
        "Authentication is not configured.",
        503,
      );
    instance = createNeonAuth({
      baseUrl,
      cookies: { secret, sessionDataTtl: 1 },
      logLevel: "silent",
    });
  }
  return instance;
}

import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";
import { cookies } from "next/headers";
import { z } from "zod";

const AuthEnvironmentSchema = z.object({
  NEON_AUTH_BASE_URL: z.string().url(),
  NEON_AUTH_COOKIE_SECRET: z.string().min(32),
});

let cachedAuth: ReturnType<typeof createNeonAuth> | undefined;

export function isNeonAuthConfigured(): boolean {
  return AuthEnvironmentSchema.safeParse(process.env).success;
}

export function getNeonAuth() {
  if (cachedAuth) return cachedAuth;

  const environment = AuthEnvironmentSchema.parse(process.env);
  cachedAuth = createNeonAuth({
    baseUrl: environment.NEON_AUTH_BASE_URL,
    cookies: {
      secret: environment.NEON_AUTH_COOKIE_SECRET,
      sessionDataTtl: 60,
      sameSite: "lax",
    },
    logLevel: "silent",
  });
  return cachedAuth;
}

const NEON_AUTH_BROWSER_COOKIES = [
  "__Secure-neon-auth.local.session_token",
  "__Secure-neon-auth.local.session_data",
  "__Secure-neon-auth.session_challenge",
  "__Secure-neon-auth.session_challange",
] as const;

export async function clearNeonAuthCookies(): Promise<void> {
  const store = await cookies();
  for (const name of NEON_AUTH_BROWSER_COOKIES) {
    store.set(name, "", {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }
}

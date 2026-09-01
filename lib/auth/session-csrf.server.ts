import "server-only";

import { cookies, headers } from "next/headers";
import { z } from "zod";
import {
  SESSION_CSRF_COOKIE_NAME,
  SESSION_CSRF_HEADER_NAME,
  createSessionCsrfToken,
  verifySessionCsrfToken,
} from "./session-csrf";

function getSecret(): string {
  return z.string().min(32).parse(process.env.CSRF_SIGNING_SECRET);
}

export async function issueSessionCsrfCookie(sessionId: string): Promise<void> {
  const store = await cookies();
  store.set(
    SESSION_CSRF_COOKIE_NAME,
    createSessionCsrfToken(getSecret(), sessionId),
    { httpOnly: false, secure: true, sameSite: "lax", path: "/", maxAge: 3600 },
  );
}

export async function requireSessionCsrf(sessionId: string): Promise<void> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  if (
    !verifySessionCsrfToken(
      getSecret(),
      sessionId,
      cookieStore.get(SESSION_CSRF_COOKIE_NAME)?.value,
      headerStore.get(SESSION_CSRF_HEADER_NAME),
    )
  ) {
    throw new Error("Session anti-CSRF validation failed");
  }
}

export async function clearSessionCsrfCookie(): Promise<void> {
  (await cookies()).set(SESSION_CSRF_COOKIE_NAME, "", {
    httpOnly: false,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

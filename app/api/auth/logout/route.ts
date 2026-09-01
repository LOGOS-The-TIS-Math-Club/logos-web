import { NextResponse } from "next/server";

import { clearNeonAuthCookies, getNeonAuth } from "@/lib/auth/neon.server";
import {
  clearSessionCsrfCookie,
  requireSessionCsrf,
} from "@/lib/auth/session-csrf.server";

export async function POST() {
  const auth = getNeonAuth();
  try {
    const sessionResult = await auth.getSession({
      query: { disableCookieCache: "true" },
    });
    if (sessionResult.error) throw new Error("Session lookup failed");
    const session = sessionResult.data;
    if (session?.session.id) await requireSessionCsrf(session.session.id);
  } catch {
    return NextResponse.json({ code: "SESSION_CSRF_INVALID" }, { status: 403 });
  }

  try {
    await auth.signOut();
  } catch {
    // Keep the response generic; local authorization never depends on this call.
  }
  await clearNeonAuthCookies();
  await clearSessionCsrfCookie();
  return NextResponse.json({ signedOut: true });
}

import { headers } from "next/headers";
import { NextResponse } from "next/server";

import { associateCurrentGoogleIdentity } from "@/lib/auth/identity-access.server";
import { getNeonAuth } from "@/lib/auth/neon.server";
import { issueSessionCsrfCookie } from "@/lib/auth/session-csrf.server";
import { withDatabase } from "@/lib/db/client.server";
import { recordSecurityAuditEvent } from "@/lib/security/audit";
import { CORRELATION_HEADER_NAME } from "@/lib/security/correlation";
import {
  processAuthMiddleware,
  DEFAULT_AUTH_SKIP_ROUTES,
} from "@neondatabase/auth/server";

export async function GET(request: Request) {
  const correlationId =
    (await headers()).get(CORRELATION_HEADER_NAME) ?? crypto.randomUUID();

  const url = new URL(request.url);
  const baseUrl = process.env.NEON_AUTH_BASE_URL;
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET;

  if (
    url.searchParams.has("neon_auth_session_verifier") &&
    baseUrl &&
    cookieSecret &&
    cookieSecret.length >= 32
  ) {
    const result = await processAuthMiddleware({
      request,
      pathname: url.pathname,
      skipRoutes: DEFAULT_AUTH_SKIP_ROUTES,
      loginUrl: "/auth/sign-in",
      baseUrl,
      cookieSecret,
      sessionDataTtl: 60,
      sameSite: "lax",
    });

    if (result.action === "redirect_oauth") {
      const oauthHeaders = new Headers();
      for (const cookie of result.cookies) {
        oauthHeaders.append("Set-Cookie", cookie);
      }
      return NextResponse.redirect(result.redirectUrl, {
        headers: oauthHeaders,
      });
    }
  }

  try {
    await associateCurrentGoogleIdentity(correlationId);
    const session = (await getNeonAuth().getSession()).data;
    if (!session?.session.id) throw new Error("Session unavailable");
    await issueSessionCsrfCookie(session.session.id);
    return NextResponse.redirect(new URL("/auth/status", request.url));
  } catch (error) {
    console.error("[auth/complete] failed to associate identity:", error);
    await withDatabase((database) =>
      recordSecurityAuditEvent(database, {
        actorType: "anonymous",
        actorRoleSnapshot: "none",
        source: "web",
        correlationId,
        category: "authentication",
        action: "callback",
        targetType: "provider",
        targetId: "google",
        result: "failed",
        reasonCode: "identity_verification_failed",
      }),
    ).catch(() => undefined);
    return NextResponse.redirect(
      new URL("/auth/status?state=failed", request.url),
    );
  }
}

import { NextResponse } from "next/server";

import { getNeonAuth } from "@/lib/auth/neon.server";
import { withDatabase } from "@/lib/db/client.server";
import {
  generateCorrelationId,
  getCorrelationId,
} from "@/lib/security/correlation";
import { recordSecurityAuditEvent } from "@/lib/security/audit";
import { AUTH_ATTEMPT_POLICY, checkRateLimit } from "@/lib/security/rate-limit";

function rateLimitSubject(request: Request): string {
  const candidate =
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim();
  return candidate && candidate.length <= 64 ? candidate : "network-unknown";
}

export async function POST(request: Request) {
  const correlationId =
    getCorrelationId(request.headers) ?? generateCorrelationId();
  try {
    const limit = await withDatabase((database) =>
      database.transaction(async (transaction) => {
        const result = await checkRateLimit({
          db: transaction,
          policy: AUTH_ATTEMPT_POLICY,
          rawIdentifier: rateLimitSubject(request),
        });
        await recordSecurityAuditEvent(transaction, {
          actorType: "anonymous",
          actorRoleSnapshot: "none",
          source: "web",
          correlationId,
          category: "authentication",
          action: "sign_in_start",
          targetType: "provider",
          targetId: "google",
          result: result.success ? "success" : "rate_limited",
          reasonCode: result.success
            ? "provider_redirect_requested"
            : "auth_rate_limited",
          metadata: { policy: AUTH_ATTEMPT_POLICY.name },
        });
        return result;
      }),
    );
    if (!limit.success) {
      return NextResponse.json(
        { code: "AUTH_RATE_LIMITED", correlationId },
        {
          status: 429,
          headers: { "Retry-After": String(limit.retryAfterSeconds) },
        },
      );
    }
    const result = await getNeonAuth().signIn.social({
      provider: "google",
      callbackURL: "/auth/complete",
      scopes: ["openid", "email", "profile"],
    });
    if (result.error) {
      console.error("[AUTH_GOOGLE_START_NEON_ERROR]", result.error);
    }
    const url = result.data?.url;
    if (!url) {
      throw new Error(
        `Provider redirect unavailable: ${JSON.stringify(result.error || "no data url")}`,
      );
    }
    await withDatabase((database) =>
      recordSecurityAuditEvent(database, {
        actorType: "anonymous",
        actorRoleSnapshot: "none",
        source: "web",
        correlationId,
        category: "authentication",
        action: "provider_redirect",
        targetType: "provider",
        targetId: "google",
        result: "success",
        reasonCode: "provider_redirect_created",
      }),
    );
    return NextResponse.json({ url });
  } catch (error) {
    console.error("[AUTH_GOOGLE_START_EXCEPTION]", error);
    await withDatabase((database) =>
      recordSecurityAuditEvent(database, {
        actorType: "anonymous",
        actorRoleSnapshot: "none",
        source: "web",
        correlationId,
        category: "authentication",
        action: "provider_redirect",
        targetType: "provider",
        targetId: "google",
        result: "failed",
        reasonCode: "provider_unavailable",
      }),
    ).catch(() => undefined);
    return NextResponse.json(
      { code: "AUTH_PROVIDER_UNAVAILABLE", correlationId },
      { status: 503 },
    );
  }
}

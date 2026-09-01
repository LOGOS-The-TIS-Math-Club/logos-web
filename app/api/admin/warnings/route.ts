import { type NextRequest, NextResponse } from "next/server";

import {
  AccessDeniedError,
  requireCapability,
} from "@/lib/auth/identity-access.server";
import {
  issueManualWarning,
  listWarnings,
  resolveWarning,
  WarningNotFoundError,
} from "@/lib/attendance/service.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

export async function GET(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    await requireCapability("warning:manage", correlationId);
    const memberId = request.nextUrl.searchParams.get("memberId") || undefined;
    const warnings = await listWarnings(memberId);
    return NextResponse.json({ success: true, warnings });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to view warning records.",
        },
        { status: 403 },
      );
    }

    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    const body = await request.json();
    const warning = await issueManualWarning(body, correlationId);
    return NextResponse.json({ success: true, warning }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to issue warnings.",
        },
        { status: 403 },
      );
    }

    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

export async function PATCH(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    const body = await request.json();
    const resolved = await resolveWarning(body.warningId, correlationId);
    return NextResponse.json({ success: true, warning: resolved });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to resolve warnings.",
        },
        { status: 403 },
      );
    }

    if (error instanceof WarningNotFoundError) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Warning record not found." },
        { status: 404 },
      );
    }

    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

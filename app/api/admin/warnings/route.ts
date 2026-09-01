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
      return createSafeErrorResponse(
        "FORBIDDEN",
        403,
        correlationId,
        "You do not have permission to view warning records.",
      );
    }

    return createSafeErrorResponse(
      "INTERNAL_SERVER_ERROR",
      500,
      correlationId,
      "Failed to retrieve warning records.",
    );
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
      return createSafeErrorResponse(
        "FORBIDDEN",
        403,
        correlationId,
        "You do not have permission to issue warnings.",
      );
    }

    return createSafeErrorResponse(
      "INTERNAL_SERVER_ERROR",
      500,
      correlationId,
      "Failed to issue warning.",
    );
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
      return createSafeErrorResponse(
        "FORBIDDEN",
        403,
        correlationId,
        "You do not have permission to resolve warnings.",
      );
    }

    if (error instanceof WarningNotFoundError) {
      return createSafeErrorResponse(
        "NOT_FOUND",
        404,
        correlationId,
        "Warning record not found.",
      );
    }

    return createSafeErrorResponse(
      "INTERNAL_SERVER_ERROR",
      500,
      correlationId,
      "Failed to resolve warning.",
    );
  }
}

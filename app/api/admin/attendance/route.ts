import { type NextRequest, NextResponse } from "next/server";

import {
  AccessDeniedError,
  requireCapability,
} from "@/lib/auth/identity-access.server";
import {
  getSessionAttendance,
  recordSessionAttendance,
  SessionNotFoundError,
} from "@/lib/attendance/service.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

export async function GET(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return createSafeErrorResponse(
      "BAD_REQUEST",
      400,
      correlationId,
      "sessionId query parameter is required.",
    );
  }

  try {
    await requireCapability("attendance:record", correlationId);
    const data = await getSessionAttendance(sessionId);
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return createSafeErrorResponse(
        "FORBIDDEN",
        403,
        correlationId,
        "You do not have permission to view attendance rosters.",
      );
    }

    if (error instanceof SessionNotFoundError) {
      return createSafeErrorResponse(
        "NOT_FOUND",
        404,
        correlationId,
        "Session not found.",
      );
    }

    return createSafeErrorResponse(
      "INTERNAL_SERVER_ERROR",
      500,
      correlationId,
      "Failed to retrieve session attendance roster.",
    );
  }
}

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    const body = await request.json();
    const result = await recordSessionAttendance(
      body.sessionId,
      body.records,
      correlationId,
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return createSafeErrorResponse(
        "FORBIDDEN",
        403,
        correlationId,
        "You do not have permission to record attendance.",
      );
    }

    if (error instanceof SessionNotFoundError) {
      return createSafeErrorResponse(
        "NOT_FOUND",
        404,
        correlationId,
        "Session not found.",
      );
    }

    return createSafeErrorResponse(
      "INTERNAL_SERVER_ERROR",
      500,
      correlationId,
      "Failed to record session attendance.",
    );
  }
}

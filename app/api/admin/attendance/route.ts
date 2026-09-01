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
    return NextResponse.json(
      {
        code: "BAD_REQUEST",
        message: "sessionId query parameter is required.",
      },
      { status: 400 },
    );
  }

  try {
    await requireCapability("attendance:record", correlationId);
    const data = await getSessionAttendance(sessionId);
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to view attendance rosters.",
        },
        { status: 403 },
      );
    }

    if (error instanceof SessionNotFoundError) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Session not found." },
        { status: 404 },
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
    const result = await recordSessionAttendance(
      body.sessionId,
      body.records,
      correlationId,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to record attendance.",
        },
        { status: 403 },
      );
    }

    if (error instanceof SessionNotFoundError) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Session not found." },
        { status: 404 },
      );
    }

    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

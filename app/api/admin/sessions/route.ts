import { type NextRequest, NextResponse } from "next/server";

import {
  AccessDeniedError,
  requireCapability,
} from "@/lib/auth/identity-access.server";
import {
  createClubSession,
  listClubSessions,
} from "@/lib/attendance/service.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

export async function GET(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    await requireCapability("session:manage", correlationId);
    const sessions = await listClubSessions();
    return NextResponse.json({ success: true, sessions });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return createSafeErrorResponse(
        "FORBIDDEN",
        403,
        correlationId,
        "You do not have permission to view club sessions.",
      );
    }

    return createSafeErrorResponse(
      "INTERNAL_SERVER_ERROR",
      500,
      correlationId,
      "Failed to retrieve club sessions.",
    );
  }
}

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    const body = await request.json();
    const session = await createClubSession(body, correlationId);
    return NextResponse.json({ success: true, session }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return createSafeErrorResponse(
        "FORBIDDEN",
        403,
        correlationId,
        "You do not have permission to create club sessions.",
      );
    }

    return createSafeErrorResponse(
      "INTERNAL_SERVER_ERROR",
      500,
      correlationId,
      "Failed to create club session.",
    );
  }
}

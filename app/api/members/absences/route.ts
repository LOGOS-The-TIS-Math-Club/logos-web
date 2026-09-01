import { type NextRequest, NextResponse } from "next/server";

import { AccessDeniedError } from "@/lib/auth/identity-access.server";
import {
  MemberNotActiveError,
  submitExpectedAbsence,
} from "@/lib/attendance/service.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    const body = await request.json();
    const absence = await submitExpectedAbsence(body, correlationId);
    return NextResponse.json({ success: true, absence }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return createSafeErrorResponse(
        "FORBIDDEN",
        403,
        correlationId,
        "You do not have permission to submit expected absences.",
      );
    }

    if (error instanceof MemberNotActiveError) {
      return createSafeErrorResponse(
        "FORBIDDEN",
        403,
        correlationId,
        "Only active LOGOS members can submit expected absences.",
      );
    }

    return createSafeErrorResponse(
      "INTERNAL_SERVER_ERROR",
      500,
      correlationId,
      "Failed to submit expected absence.",
    );
  }
}

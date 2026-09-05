import { type NextRequest, NextResponse } from "next/server";

import { AccessDeniedError } from "@/lib/auth/identity-access.server";
import {
  deleteClubSession,
  SessionInUseError,
  SessionNotFoundError,
  updateClubSession,
} from "@/lib/attendance/service.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    const body = await request.json();
    const session = await updateClubSession(id, body, correlationId);
    return NextResponse.json({ success: true, session });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to edit club sessions.",
        },
        { status: 403 },
      );
    }

    if (error instanceof SessionNotFoundError) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Club session not found." },
        { status: 404 },
      );
    }

    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    await deleteClubSession(id, correlationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to delete club sessions.",
        },
        { status: 403 },
      );
    }

    if (error instanceof SessionNotFoundError) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Club session not found." },
        { status: 404 },
      );
    }

    if (error instanceof SessionInUseError) {
      // 409, not 400: the request is valid, the session's state is what
      // prevents it. The message names the records so the answer is actionable.
      const parts = [
        error.attendanceCount > 0
          ? `${error.attendanceCount} attendance record${error.attendanceCount === 1 ? "" : "s"}`
          : null,
        error.absenceCount > 0
          ? `${error.absenceCount} absence${error.absenceCount === 1 ? "" : "s"}`
          : null,
      ].filter(Boolean);

      return NextResponse.json(
        {
          code: "CONFLICT",
          message: `This session has ${parts.join(" and ")} against it. Clear those first if you really mean to remove it.`,
        },
        { status: 409 },
      );
    }

    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

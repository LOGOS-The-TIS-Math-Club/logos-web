import { type NextRequest, NextResponse } from "next/server";

import { AccessDeniedError } from "@/lib/auth/identity-access.server";
import {
  activateMemberFromApplication,
  ApplicationNotAcceptedError,
  ApplicationNotFoundError,
  DuplicateActiveMemberError,
  listMembers,
} from "@/lib/membership/service.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

export async function GET(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    const members = await listMembers(correlationId);
    return NextResponse.json({ success: true, members });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to view club members.",
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
    const member = await activateMemberFromApplication(body, correlationId);
    return NextResponse.json({ success: true, member }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to activate club members.",
        },
        { status: 403 },
      );
    }

    if (error instanceof ApplicationNotFoundError) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Application not found." },
        { status: 404 },
      );
    }

    if (error instanceof ApplicationNotAcceptedError) {
      return NextResponse.json(
        { code: "CONFLICT", message: error.message },
        { status: 400 },
      );
    }

    if (error instanceof DuplicateActiveMemberError) {
      return NextResponse.json(
        { code: "CONFLICT", message: error.message },
        { status: 409 },
      );
    }

    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

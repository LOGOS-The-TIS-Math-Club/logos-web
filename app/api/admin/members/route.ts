import { type NextRequest, NextResponse } from "next/server";

import {
  AccessDeniedError,
  requireCapability,
} from "@/lib/auth/identity-access.server";
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
      return createSafeErrorResponse(
        "FORBIDDEN",
        403,
        correlationId,
        "You do not have permission to view club members.",
      );
    }

    return createSafeErrorResponse(
      "INTERNAL_SERVER_ERROR",
      500,
      correlationId,
      "Failed to retrieve member records.",
    );
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
      return createSafeErrorResponse(
        "FORBIDDEN",
        403,
        correlationId,
        "You do not have permission to activate club members.",
      );
    }

    if (error instanceof ApplicationNotFoundError) {
      return createSafeErrorResponse(
        "NOT_FOUND",
        404,
        correlationId,
        "Application not found.",
      );
    }

    if (error instanceof ApplicationNotAcceptedError) {
      return createSafeErrorResponse(
        "CONFLICT",
        400,
        correlationId,
        error.message,
      );
    }

    if (error instanceof DuplicateActiveMemberError) {
      return createSafeErrorResponse(
        "CONFLICT",
        409,
        correlationId,
        error.message,
      );
    }

    return createSafeErrorResponse(
      "INTERNAL_SERVER_ERROR",
      500,
      correlationId,
      "Failed to activate club member.",
    );
  }
}

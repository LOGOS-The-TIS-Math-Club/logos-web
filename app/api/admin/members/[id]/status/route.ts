import { type NextRequest, NextResponse } from "next/server";

import { AccessDeniedError } from "@/lib/auth/identity-access.server";
import {
  MemberNotFoundError,
  updateMemberStatus,
} from "@/lib/membership/service.server";
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
    const updated = await updateMemberStatus(id, body, correlationId);
    return NextResponse.json({ success: true, member: updated });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return createSafeErrorResponse(
        "FORBIDDEN",
        403,
        correlationId,
        "You do not have permission to update member status.",
      );
    }

    if (error instanceof MemberNotFoundError) {
      return createSafeErrorResponse(
        "NOT_FOUND",
        404,
        correlationId,
        "Member not found.",
      );
    }

    return createSafeErrorResponse(
      "INTERNAL_SERVER_ERROR",
      500,
      correlationId,
      "Failed to update member status.",
    );
  }
}

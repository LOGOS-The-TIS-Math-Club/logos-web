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
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to update member status.",
        },
        { status: 403 },
      );
    }

    if (error instanceof MemberNotFoundError) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Member not found." },
        { status: 404 },
      );
    }

    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

import { type NextRequest, NextResponse } from "next/server";

import { AccessDeniedError } from "@/lib/auth/identity-access.server";
import {
  MemberNotFoundError,
  updateOwnDisplayName,
} from "@/lib/membership/service.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

/*
 * A member renaming themselves.
 *
 * Deliberately takes no member id. The service resolves the caller's own
 * identity and scopes the write to it, so there is no id a caller could
 * substitute to rename somebody else.
 */
export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    const body = await request.json();
    const member = await updateOwnDisplayName(body, correlationId);
    return NextResponse.json({
      success: true,
      displayName: member.displayName,
    });
  } catch (error) {
    /*
     * resolveCurrentIdentity throws this for a caller with no valid session.
     * Without the branch it fell through to a 500, which is both wrong for the
     * client and a fake server error in the logs.
     */
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Sign in to change your name." },
        { status: 401 },
      );
    }

    if (error instanceof MemberNotFoundError) {
      return NextResponse.json(
        {
          code: "NOT_FOUND",
          message: "You do not have an active club membership.",
        },
        { status: 404 },
      );
    }

    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

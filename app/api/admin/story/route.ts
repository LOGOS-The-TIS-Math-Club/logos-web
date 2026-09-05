import { type NextRequest, NextResponse } from "next/server";

import { AccessDeniedError } from "@/lib/auth/identity-access.server";
import { createStoryEntry, listStoryEntries } from "@/lib/story/service.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

function forbidden() {
  return NextResponse.json(
    {
      code: "FORBIDDEN",
      message: "You do not have permission to manage the club story.",
    },
    { status: 403 },
  );
}

export async function GET(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    return NextResponse.json({
      success: true,
      entries: await listStoryEntries(correlationId),
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) return forbidden();
    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    const entry = await createStoryEntry(await request.json(), correlationId);
    return NextResponse.json({ success: true, entry }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) return forbidden();
    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

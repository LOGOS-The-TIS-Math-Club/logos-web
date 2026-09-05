import { type NextRequest, NextResponse } from "next/server";

import { AccessDeniedError } from "@/lib/auth/identity-access.server";
import {
  deleteStoryEntry,
  StoryEntryNotFoundError,
  updateStoryEntry,
} from "@/lib/story/service.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

function toResponse(error: unknown, correlationId: string) {
  if (error instanceof AccessDeniedError) {
    return NextResponse.json(
      {
        code: "FORBIDDEN",
        message: "You do not have permission to manage the club story.",
      },
      { status: 403 },
    );
  }

  if (error instanceof StoryEntryNotFoundError) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Story entry not found." },
      { status: 404 },
    );
  }

  return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    const entry = await updateStoryEntry(
      id,
      await request.json(),
      correlationId,
    );
    return NextResponse.json({ success: true, entry });
  } catch (error) {
    return toResponse(error, correlationId);
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
    await deleteStoryEntry(id, correlationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toResponse(error, correlationId);
  }
}

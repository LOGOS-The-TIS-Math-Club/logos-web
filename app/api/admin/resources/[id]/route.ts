import { type NextRequest, NextResponse } from "next/server";

import { AccessDeniedError } from "@/lib/auth/identity-access.server";
import {
  deleteResource,
  ResourceNotFoundError,
  updateResource,
} from "@/lib/resources/service.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

function toResponse(error: unknown, correlationId: string) {
  if (error instanceof AccessDeniedError) {
    return NextResponse.json(
      {
        code: "FORBIDDEN",
        message: "You do not have permission to manage club resources.",
      },
      { status: 403 },
    );
  }

  if (error instanceof ResourceNotFoundError) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Resource not found." },
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
    const body = await request.json();
    const resource = await updateResource(id, body, correlationId);
    return NextResponse.json({ success: true, resource });
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
    await deleteResource(id, correlationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return toResponse(error, correlationId);
  }
}

import { type NextRequest, NextResponse } from "next/server";

import {
  AccessDeniedError,
  requireCapability,
} from "@/lib/auth/identity-access.server";
import { createResource, listResources } from "@/lib/resources/service.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

export async function GET(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    await requireCapability("resource:manage", correlationId);
    const resources = await listResources();
    return NextResponse.json({ success: true, resources });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to manage club resources.",
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
    const resource = await createResource(body, correlationId);
    return NextResponse.json({ success: true, resource }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to manage club resources.",
        },
        { status: 403 },
      );
    }

    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

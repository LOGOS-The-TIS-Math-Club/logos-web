import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import { updateApplicationStatus } from "@/lib/applications/service.server";
import { type ApplicationStatusUpdate } from "@/lib/applications/schema";
import { AccessDeniedError } from "@/lib/auth/errors";

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get("x-correlation-id") || crypto.randomUUID();

  let body: { applicationId?: string; status?: string; statusReason?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid payload" },
      { status: 400 },
    );
  }

  if (!body.applicationId) {
    return NextResponse.json(
      { code: "MISSING_APPLICATION_ID", message: "Application ID is required" },
      { status: 400 },
    );
  }

  try {
    const updated = await updateApplicationStatus(
      body.applicationId,
      {
        status: body.status as ApplicationStatusUpdate["status"],
        statusReason: body.statusReason ?? null,
      },
      correlationId,
    );

    return NextResponse.json({
      success: true,
      applicationId: updated.id,
      status: updated.status,
      statusReason: updated.statusReason,
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        { code: "FORBIDDEN", message: "Insufficient capability" },
        { status: 403 },
      );
    }

    if (error instanceof ZodError) {
      return NextResponse.json(
        { code: "VALIDATION_FAILED", message: "Invalid status parameters" },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Failed to update status" },
      { status: 500 },
    );
  }
}

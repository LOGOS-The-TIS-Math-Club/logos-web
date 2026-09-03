import { type NextRequest, NextResponse } from "next/server";

import {
  createAnnouncement,
  deleteAnnouncement,
  updateAnnouncement,
} from "@/lib/announcements/service.server";
import { AnnouncementInputSchema } from "@/lib/announcements/schema";
import { AccessDeniedError } from "@/lib/auth/errors";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

/*
 * Announcement mutations.
 *
 * Every handler delegates authorization to the service, which requires
 * announcement:manage and writes an audit event inside the same transaction.
 * Origin and CSRF are already enforced upstream in proxy.ts.
 */

function correlationOf(request: NextRequest) {
  return (
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID()
  );
}

function forbidden() {
  return NextResponse.json(
    {
      code: "FORBIDDEN",
      message: "You do not have permission to manage announcements.",
    },
    { status: 403 },
  );
}

export async function POST(request: NextRequest) {
  const correlationId = correlationOf(request);
  try {
    const parsed = AnnouncementInputSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    const created = await createAnnouncement(parsed.data, correlationId);
    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    if (error instanceof AccessDeniedError) return forbidden();
    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

export async function PATCH(request: NextRequest) {
  const correlationId = correlationOf(request);
  try {
    const payload = (await request.json()) as { id?: unknown };
    if (typeof payload.id !== "string" || payload.id.length === 0) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "An announcement id is required." },
        { status: 400 },
      );
    }

    const parsed = AnnouncementInputSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: parsed.error.issues[0].message },
        { status: 400 },
      );
    }

    await updateAnnouncement(payload.id, parsed.data, correlationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AccessDeniedError) return forbidden();
    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

export async function DELETE(request: NextRequest) {
  const correlationId = correlationOf(request);
  try {
    const payload = (await request.json()) as { id?: unknown };
    if (typeof payload.id !== "string" || payload.id.length === 0) {
      return NextResponse.json(
        { code: "INVALID_INPUT", message: "An announcement id is required." },
        { status: 400 },
      );
    }

    await deleteAnnouncement(payload.id, correlationId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AccessDeniedError) return forbidden();
    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

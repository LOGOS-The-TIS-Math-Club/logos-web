import { type NextRequest, NextResponse } from "next/server";

import { AccessDeniedError } from "@/lib/auth/identity-access.server";
import { MAX_IMAGE_BYTES } from "@/lib/images/format";
import {
  ImageRejectedError,
  listImages,
  storeImage,
} from "@/lib/images/service.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

function forbidden() {
  return NextResponse.json(
    {
      code: "FORBIDDEN",
      message: "You do not have permission to manage images.",
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
      images: await listImages(correlationId),
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
    const form = await request.formData();
    const file = form.get("file");
    const altText = form.get("altText");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "No file was uploaded." },
        { status: 400 },
      );
    }

    /*
     * Checked before the body is read into memory. The full validation runs in
     * the service against the actual bytes, but there is no reason to buffer
     * an oversized upload first just to reject it.
     */
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        {
          code: "PAYLOAD_TOO_LARGE",
          message: `Images must be ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`,
        },
        { status: 413 },
      );
    }

    const image = await storeImage(
      {
        bytes: new Uint8Array(await file.arrayBuffer()),
        declaredType: file.type,
        altText: typeof altText === "string" ? altText : "",
      },
      correlationId,
    );

    return NextResponse.json({ success: true, image }, { status: 201 });
  } catch (error) {
    if (error instanceof AccessDeniedError) return forbidden();

    // The rejection messages are written for the person uploading and contain
    // nothing but facts about their own file, so they are safe to surface.
    if (error instanceof ImageRejectedError) {
      return NextResponse.json(
        { code: "UNPROCESSABLE_ENTITY", message: error.message },
        { status: 422 },
      );
    }

    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

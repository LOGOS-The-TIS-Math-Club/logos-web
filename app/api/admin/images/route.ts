import { type NextRequest, NextResponse } from "next/server";

import {
  AccessDeniedError,
  requireCapability,
} from "@/lib/auth/identity-access.server";
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

/*
 * Multipart framing adds a boundary and a few headers around the file, so the
 * body is legitimately a little larger than the image itself.
 */
const MAX_UPLOAD_BODY_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

function tooLarge() {
  return NextResponse.json(
    {
      code: "PAYLOAD_TOO_LARGE",
      message: `Images must be ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`,
    },
    { status: 413 },
  );
}

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  try {
    /*
     * Authorization first, before the body is touched.
     *
     * request.formData() buffers the entire request into memory, and the
     * capability check used to sit after it inside storeImage — so any signed
     * in member, who holds valid CSRF tokens, could make the server buffer an
     * upload of any size before being told they were not allowed to upload at
     * all. The check is cheap and belongs ahead of the expensive part.
     */
    await requireCapability("content:manage", correlationId);

    /*
     * Then the declared length, still before parsing. Content-Length is absent
     * on a chunked request and can be a lie on any request, so this is an
     * early exit for the honest case rather than the real limit — the real one
     * is the byte-length check in the service, which sees the actual file.
     */
    const declaredLength = Number(request.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_UPLOAD_BODY_BYTES
    ) {
      return tooLarge();
    }

    const form = await request.formData();
    const file = form.get("file");
    const altText = form.get("altText");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "No file was uploaded." },
        { status: 400 },
      );
    }

    if (file.size > MAX_IMAGE_BYTES) return tooLarge();

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

import { type NextRequest, NextResponse } from "next/server";

import { getImage, ImageNotFoundError } from "@/lib/images/service.server";

/*
 * Serves an uploaded image.
 *
 * Public, because these appear on the public home and story pages. The id is a
 * random UUID; that is what keeps an image attached to unpublished content from
 * being stumbled upon.
 */

export const dynamic = "force-dynamic";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  // Checked before the query so a malformed id is a cheap 404 rather than a
  // database round trip and a driver-level type error.
  if (!UUID_PATTERN.test(id)) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    const image = await getImage(id);

    return new NextResponse(new Uint8Array(image.data), {
      status: 200,
      headers: {
        // The stored type, which was verified against the file's own magic
        // bytes at upload rather than taken from the uploader's claim.
        "Content-Type": image.mimeType,
        "Content-Length": String(image.byteSize),
        /*
         * Defence in depth for user-supplied bytes served from our own origin:
         * nosniff stops a browser second-guessing the declared type, inline
         * disposition stops it being treated as a download, and the response's
         * own CSP means that even if something non-image got this far it has
         * no privileges to use.
         */
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": "inline",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        // The bytes for a given id never change, so this is safe to cache hard.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    if (error instanceof ImageNotFoundError) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(null, { status: 500 });
  }
}

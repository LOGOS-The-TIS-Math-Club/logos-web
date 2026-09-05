import "server-only";

import { eq } from "drizzle-orm";

import { images } from "@/db/schema";
import { requireCapability } from "@/lib/auth/identity-access.server";
import { withDatabase } from "@/lib/db/client.server";
import { recordBusinessAuditEvent } from "@/lib/security/audit";
import { readImageDimensions } from "./dimensions";
import { type AllowedImageType, validateImageUpload } from "./format";

export class ImageNotFoundError extends Error {
  constructor(readonly imageId: string) {
    super("Image not found");
    this.name = "ImageNotFoundError";
  }
}

export class ImageRejectedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "ImageRejectedError";
  }
}

export interface StoredImage {
  id: string;
  mimeType: AllowedImageType;
  byteSize: number;
  altText: string;
  data: Buffer;
}

export interface ImageSummary {
  id: string;
  mimeType: string;
  byteSize: number;
  altText: string;
  width: number | null;
  height: number | null;
  createdAt: string;
}

/**
 * Stores an uploaded image. Requires 'content:manage'.
 *
 * Validation happens here rather than only in the route, so no future caller
 * can reach the table without it.
 */
export async function storeImage(
  input: { bytes: Uint8Array; declaredType: string; altText: string },
  correlationId: string,
) {
  const actor = await requireCapability("content:manage", correlationId);

  const altText = input.altText.trim();
  if (!altText) {
    throw new ImageRejectedError(
      "Describe the image so screen reader users know what it shows.",
    );
  }
  if (altText.length > 300) {
    throw new ImageRejectedError(
      "The description must be 300 characters or fewer.",
    );
  }

  const verdict = validateImageUpload(input.declaredType, input.bytes);
  if (!verdict.ok) throw new ImageRejectedError(verdict.reason);

  // Read once at upload rather than on every page render.
  const dimensions = readImageDimensions(input.bytes);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [image] = await transaction
        .insert(images)
        .values({
          mimeType: verdict.type,
          byteSize: input.bytes.byteLength,
          altText,
          width: dimensions?.width ?? null,
          height: dimensions?.height ?? null,
          data: Buffer.from(input.bytes),
          uploadedByIdentityId: actor.identityId,
        })
        .returning({
          id: images.id,
          mimeType: images.mimeType,
          byteSize: images.byteSize,
          altText: images.altText,
          width: images.width,
          height: images.height,
          createdAt: images.createdAt,
        });

      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "web",
        correlationId,
        category: "content",
        action: "upload_image",
        targetType: "image",
        targetId: image.id,
        result: "success",
        afterSummary: { mimeType: image.mimeType, byteSize: image.byteSize },
      });

      return {
        ...image,
        createdAt: image.createdAt.toISOString(),
      } satisfies ImageSummary;
    }),
  );
}

/**
 * Reads one image for serving.
 *
 * Capability-free: images appear on the public home page and story page, so
 * the bytes have to be readable without a session. Ids are random UUIDs, which
 * is what keeps an image attached to unpublished content from being found —
 * it is not secret, just unguessable, and nothing sensitive should be uploaded
 * on the strength of it.
 */
export async function getImage(imageId: string): Promise<StoredImage> {
  return withDatabase(async (database) => {
    const [image] = await database
      .select({
        id: images.id,
        mimeType: images.mimeType,
        byteSize: images.byteSize,
        altText: images.altText,
        data: images.data,
      })
      .from(images)
      .where(eq(images.id, imageId))
      .limit(1);

    if (!image) throw new ImageNotFoundError(imageId);

    return image as StoredImage;
  });
}

/** The image library, for picking one when editing content. */
export async function listImages(
  correlationId: string,
): Promise<ImageSummary[]> {
  await requireCapability("content:manage", correlationId);

  return withDatabase(async (database) => {
    const rows = await database
      .select({
        id: images.id,
        mimeType: images.mimeType,
        byteSize: images.byteSize,
        altText: images.altText,
        width: images.width,
        height: images.height,
        createdAt: images.createdAt,
      })
      .from(images)
      .orderBy(images.createdAt);

    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    }));
  });
}

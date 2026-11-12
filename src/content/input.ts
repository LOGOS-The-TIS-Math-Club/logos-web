import { z } from "zod";
import { MAX_IMAGE_BYTES } from "./image-limits.ts";

const contentId = z.uuid().transform(value => value.toLowerCase());

const imageBytes = z.custom<Uint8Array>(
  (value) => value instanceof Uint8Array && value.byteLength > 0 && value.byteLength <= MAX_IMAGE_BYTES,
  "Image must contain between 1 byte and 2 MiB",
);

export const imageInput = z.object({
  data: imageBytes,
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  altText: z.string().trim().min(1).max(300),
});

export const storyInput = z.object({
  title: z.string().trim().min(1).max(120),
  occurredOn: z.iso.date(),
  description: z.string().trim().max(4000).default(""),
  imageId: contentId.nullable().optional(),
  published: z.boolean().default(false),
});

export const announcementInput = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(2000),
  imageId: contentId.nullable().optional(),
  published: z.boolean().default(false),
});

export const leadershipInput = z.object({
  memberId: contentId.nullable().optional(),
  displayName: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  biography: z.string().trim().max(4000).default(""),
  imageId: contentId.nullable().optional(),
  sortOrder: z.number().int().min(-2_147_483_648).max(2_147_483_647).default(0),
  published: z.boolean().default(false),
});

export const resourceInput = z.object({
  title: z.string().trim().min(1).max(80),
  description: z.string().trim().max(280).default(""),
  url: z.url().max(2048).refine((value) => {
    try {
      return new URL(value).protocol === "https:" && !/[\s]/.test(value);
    } catch {
      return false;
    }
  }, "URL must be an HTTPS link"),
  sortOrder: z.number().int().min(-2_147_483_648).max(2_147_483_647).default(0),
  published: z.boolean().default(false),
});

export const clubInfoInput = z.object({
  about: z.string().trim().max(10_000).default(""),
  semesterFocus: z.string().trim().max(4000).default(""),
  contactEmail: z.email().max(320),
});

export const revisionInput = z.number().int().positive();

// Required only for creates; edits retain their existing revision contract.
export const creationRequestInput = z.object({ requestId: contentId });

/*
 * What counts as an acceptable image upload.
 *
 * Pure, so every rule here is testable without a database or a request.
 */

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * The formats the club can upload.
 *
 * SVG is deliberately absent and must stay absent. An SVG is a document, not a
 * bitmap: it can carry <script>, and serving one from our own origin would run
 * that script with the site's own privileges. There is no safe way to accept
 * SVG here short of sanitising it, and the club has no need for it.
 */
export const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

export function isAllowedImageType(value: string): value is AllowedImageType {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * The format a file actually is, read from its leading bytes.
 *
 * The browser-declared Content-Type is a claim by the uploader, not a fact. A
 * file declared image/png whose body is HTML would be stored happily and then
 * served from our own origin, where a sniffing browser could execute it. The
 * bytes are the only trustworthy source, so the declared type is checked
 * against this rather than believed.
 *
 * Returns null when the bytes match nothing on the allow-list.
 */
export function detectImageType(bytes: Uint8Array): AllowedImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  // GIF87a and GIF89a.
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";

  // "RIFF" .... "WEBP" — the size field sits between the two markers.
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export type ImageRejection =
  { ok: false; reason: string } | { ok: true; type: AllowedImageType };

/**
 * Validates an upload.
 *
 * The declared type must be allowed AND the bytes must agree with it. Either
 * check alone is insufficient: trusting the declaration lets any file through,
 * and trusting only the bytes would let a file declared as something else be
 * stored under a type the rest of the system then acts on.
 */
export function validateImageUpload(
  declaredType: string,
  bytes: Uint8Array,
): ImageRejection {
  if (bytes.length === 0) {
    return { ok: false, reason: "The file is empty." };
  }

  if (bytes.length > MAX_IMAGE_BYTES) {
    return {
      ok: false,
      reason: `Images must be ${Math.floor(MAX_IMAGE_BYTES / (1024 * 1024))}MB or smaller.`,
    };
  }

  if (!isAllowedImageType(declaredType)) {
    return {
      ok: false,
      reason: "Images must be JPEG, PNG, WebP or GIF.",
    };
  }

  const actual = detectImageType(bytes);
  if (actual === null) {
    return {
      ok: false,
      reason: "That file does not look like a JPEG, PNG, WebP or GIF.",
    };
  }

  if (actual !== declaredType) {
    return {
      ok: false,
      reason: `The file is a ${actual.replace("image/", "").toUpperCase()} but was sent as ${declaredType.replace("image/", "").toUpperCase()}.`,
    };
  }

  return { ok: true, type: actual };
}

/** File extension for a stored type, used when offering a download. */
export function extensionFor(type: AllowedImageType): string {
  return type === "image/jpeg" ? "jpg" : type.replace("image/", "");
}

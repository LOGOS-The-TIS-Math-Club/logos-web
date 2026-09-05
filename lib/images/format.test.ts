import { describe, expect, it } from "vitest";

import {
  ALLOWED_IMAGE_TYPES,
  detectImageType,
  extensionFor,
  isAllowedImageType,
  MAX_IMAGE_BYTES,
  validateImageUpload,
} from "./format";

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00,
]);
const GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
const WEBP = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe("detectImageType", () => {
  it.each([
    [JPEG, "image/jpeg"],
    [PNG, "image/png"],
    [GIF, "image/gif"],
    [WEBP, "image/webp"],
  ])("recognises %#", (bytes, expected) => {
    expect(detectImageType(bytes)).toBe(expected);
  });

  it("rejects an SVG, which is a document and can carry script", () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg">',
    );

    expect(detectImageType(svg)).toBeNull();
  });

  it("rejects HTML dressed up as an image", () => {
    const html = new TextEncoder().encode("<!doctype html><script>alert(1)");

    expect(detectImageType(html)).toBeNull();
  });

  it("rejects RIFF that is not WebP, such as a WAV file", () => {
    const wav = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);

    expect(detectImageType(wav)).toBeNull();
  });

  it("does not read past the end of a truncated file", () => {
    expect(detectImageType(new Uint8Array([0x52, 0x49]))).toBeNull();
    expect(detectImageType(new Uint8Array([]))).toBeNull();
  });
});

describe("isAllowedImageType", () => {
  it("excludes SVG from the allow-list entirely", () => {
    expect(isAllowedImageType("image/svg+xml")).toBe(false);
    expect(ALLOWED_IMAGE_TYPES).not.toContain("image/svg+xml");
  });

  it.each(["text/html", "application/pdf", "image/bmp", ""])(
    "rejects %s",
    (type) => {
      expect(isAllowedImageType(type)).toBe(false);
    },
  );
});

describe("validateImageUpload", () => {
  it("accepts a genuine PNG declared as PNG", () => {
    expect(validateImageUpload("image/png", PNG)).toEqual({
      ok: true,
      type: "image/png",
    });
  });

  it("rejects a file whose bytes disagree with its declared type", () => {
    /*
     * The declared Content-Type is a claim by the uploader. A file declared
     * image/png whose body is something else would be stored and then served
     * from our own origin, where a sniffing browser could act on it.
     */
    const result = validateImageUpload("image/png", JPEG);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: expect.stringMatching(/JPEG/i) });
  });

  it("rejects an SVG even when declared as PNG", () => {
    const svg = new TextEncoder().encode("<svg><script>alert(1)</script>");

    expect(validateImageUpload("image/png", svg).ok).toBe(false);
  });

  it("rejects an SVG declared honestly", () => {
    const svg = new TextEncoder().encode("<svg></svg>");

    expect(validateImageUpload("image/svg+xml", svg).ok).toBe(false);
  });

  it("rejects an empty file", () => {
    expect(validateImageUpload("image/png", new Uint8Array([])).ok).toBe(false);
  });

  it("rejects a file over the size cap", () => {
    const huge = new Uint8Array(MAX_IMAGE_BYTES + 1);
    huge.set(PNG);

    const result = validateImageUpload("image/png", huge);

    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ reason: expect.stringMatching(/2MB/) });
  });

  it("accepts a file exactly at the cap", () => {
    const atLimit = new Uint8Array(MAX_IMAGE_BYTES);
    atLimit.set(PNG);

    expect(validateImageUpload("image/png", atLimit).ok).toBe(true);
  });
});

describe("extensionFor", () => {
  it("maps jpeg to the conventional jpg", () => {
    expect(extensionFor("image/jpeg")).toBe("jpg");
  });

  it.each([
    ["image/png", "png"],
    ["image/webp", "webp"],
    ["image/gif", "gif"],
  ] as const)("maps %s to %s", (type, expected) => {
    expect(extensionFor(type)).toBe(expected);
  });
});

import { describe, expect, it } from "vitest";

import { readImageDimensions } from "./dimensions";

/** A minimal but structurally real PNG header declaring 800x600. */
function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes;
}

function gif(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set(new TextEncoder().encode("GIF89a"));
  const view = new DataView(bytes.buffer);
  view.setUint16(6, width, true);
  view.setUint16(8, height, true);
  return bytes;
}

/** SOI, an APP0 segment to skip past, then an SOF0 carrying the size. */
function jpeg(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(40);
  const view = new DataView(bytes.buffer);
  bytes.set([0xff, 0xd8], 0);
  bytes.set([0xff, 0xe0], 2);
  view.setUint16(4, 8, false);
  bytes.set([0xff, 0xc0], 12);
  view.setUint16(14, 17, false);
  bytes[16] = 8;
  view.setUint16(17, height, false);
  view.setUint16(19, width, false);
  return bytes;
}

function webpLossy(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set(new TextEncoder().encode("RIFF"), 0);
  bytes.set(new TextEncoder().encode("WEBP"), 8);
  bytes.set(new TextEncoder().encode("VP8 "), 12);
  const view = new DataView(bytes.buffer);
  view.setUint16(26, width, true);
  view.setUint16(28, height, true);
  return bytes;
}

describe("readImageDimensions", () => {
  it("reads a PNG", () => {
    expect(readImageDimensions(png(800, 600))).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("reads a GIF", () => {
    expect(readImageDimensions(gif(320, 240))).toEqual({
      width: 320,
      height: 240,
    });
  });

  it("reads a JPEG, skipping the segments before the frame", () => {
    // Real photos carry EXIF and thumbnails ahead of the frame header, so the
    // parser has to walk segments rather than read a fixed offset.
    expect(readImageDimensions(jpeg(1920, 1080))).toEqual({
      width: 1920,
      height: 1080,
    });
  });

  it("reads a lossy WebP", () => {
    expect(readImageDimensions(webpLossy(640, 480))).toEqual({
      width: 640,
      height: 480,
    });
  });

  it("returns null rather than throwing on a truncated file", () => {
    expect(readImageDimensions(new Uint8Array([0x89, 0x50]))).toBeNull();
    expect(readImageDimensions(new Uint8Array(0))).toBeNull();
  });

  it("returns null for bytes that are not an image", () => {
    expect(
      readImageDimensions(new TextEncoder().encode("just some text here ok")),
    ).toBeNull();
  });

  it("terminates on a malformed JPEG with a zero segment length", () => {
    // A zero length would advance the cursor by nothing and loop forever.
    const malformed = new Uint8Array(40);
    malformed.set([0xff, 0xd8], 0);
    malformed.set([0xff, 0xe0], 2);
    // Length deliberately left as 0.

    expect(readImageDimensions(malformed)).toBeNull();
  });

  it("treats a zero dimension as unknown", () => {
    // An invalid width would produce a useless reservation and an invalid
    // attribute, so it is reported as unknown instead.
    expect(readImageDimensions(png(0, 600))).toBeNull();
  });
});

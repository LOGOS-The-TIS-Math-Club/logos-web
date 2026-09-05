/*
 * Reads pixel dimensions from an image's header.
 *
 * Why bother: without width and height on the <img>, the browser does not know
 * how much room a picture needs until it has downloaded it, so the text below
 * jumps down the page as each one arrives. That is the layout shift people
 * notice as "the page moved while I was reading it". Setting the intrinsic size
 * reserves the space up front.
 *
 * Only the header is parsed — enough to find the numbers, never the pixel data.
 * Pure, so every format is testable from a handful of bytes.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

function readPng(view: DataView, bytes: Uint8Array): ImageDimensions | null {
  // IHDR is always the first chunk: 8-byte signature, 4-byte length, 4-byte
  // type, then width and height as big-endian 32-bit integers.
  if (bytes.length < 24) return null;
  return {
    width: view.getUint32(16, false),
    height: view.getUint32(20, false),
  };
}

function readGif(view: DataView, bytes: Uint8Array): ImageDimensions | null {
  // Logical screen descriptor, little-endian, immediately after "GIF89a".
  if (bytes.length < 10) return null;
  return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
}

function readJpeg(view: DataView, bytes: Uint8Array): ImageDimensions | null {
  /*
   * JPEG has no fixed header. Segments are walked until a start-of-frame
   * marker is found, skipping over the thumbnails and colour tables that come
   * first. SOF0 through SOF15 all carry the size, except DHT (C4), JPG (C8)
   * and DAC (CC), which share the numeric range but are not frames.
   */
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = bytes[offset + 1];
    if (
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc
    ) {
      return {
        height: view.getUint16(offset + 5, false),
        width: view.getUint16(offset + 7, false),
      };
    }

    const segmentLength = view.getUint16(offset + 2, false);
    // A zero or negative length would loop forever on a malformed file.
    if (segmentLength < 2) return null;
    offset += 2 + segmentLength;
  }
  return null;
}

function readWebp(view: DataView, bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 30) return null;
  const format = String.fromCharCode(
    bytes[12],
    bytes[13],
    bytes[14],
    bytes[15],
  );

  // Lossy: "VP8 " then a 10-byte frame header, sizes in the low 14 bits.
  if (format === "VP8 ") {
    return {
      width: view.getUint16(26, true) & 0x3fff,
      height: view.getUint16(28, true) & 0x3fff,
    };
  }

  // Lossless: "VP8L", 14 bits each packed across four bytes, both minus one.
  if (format === "VP8L") {
    const bits =
      bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return {
      width: (bits & 0x3fff) + 1,
      height: ((bits >> 14) & 0x3fff) + 1,
    };
  }

  // Extended: "VP8X", 24-bit sizes minus one.
  if (format === "VP8X") {
    return {
      width: (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1,
      height: (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) + 1,
    };
  }

  return null;
}

/**
 * Dimensions, or null when they cannot be determined.
 *
 * Null is not an error: an unusual but valid file should still be storable,
 * just without the layout hint. Callers treat the size as optional.
 */
export function readImageDimensions(bytes: Uint8Array): ImageDimensions | null {
  if (bytes.length < 16) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let result: ImageDimensions | null = null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) result = readPng(view, bytes);
  else if (bytes[0] === 0x47 && bytes[1] === 0x49)
    result = readGif(view, bytes);
  else if (bytes[0] === 0xff && bytes[1] === 0xd8)
    result = readJpeg(view, bytes);
  else if (bytes[0] === 0x52 && bytes[1] === 0x49)
    result = readWebp(view, bytes);

  if (!result) return null;

  // A zero dimension would make the reserved space useless and the attribute
  // invalid; treat it as unknown instead.
  if (result.width <= 0 || result.height <= 0) return null;

  return result;
}

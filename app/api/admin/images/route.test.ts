/*
 * @vitest-environment node
 *
 * Not jsdom: this route parses a multipart body, and jsdom's File is not the
 * one undici's multipart parser recognises, so the parse fails inside Node
 * rather than in anything this test is about.
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Declared inside vi.hoisted because vi.mock is lifted above the file body,
// so a plain class declaration would not exist yet when the factory runs.
const mocks = vi.hoisted(() => {
  class FakeAccessDenied extends Error {
    constructor() {
      super("Access denied");
      this.name = "AccessDeniedError";
    }
  }

  class FakeRejected extends Error {
    constructor(message: string) {
      super(message);
      this.name = "ImageRejectedError";
    }
  }

  return {
    requireCapability: vi.fn(),
    storeImage: vi.fn(),
    listImages: vi.fn(),
    FakeAccessDenied,
    FakeRejected,
  };
});

vi.mock("@/lib/auth/identity-access.server", () => ({
  requireCapability: mocks.requireCapability,
  AccessDeniedError: mocks.FakeAccessDenied,
}));

vi.mock("@/lib/images/service.server", () => ({
  storeImage: mocks.storeImage,
  listImages: mocks.listImages,
  ImageRejectedError: mocks.FakeRejected,
}));

import { POST } from "./route";

function upload(body: BodyInit, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost/api/admin/images", {
    method: "POST",
    body,
    headers,
  });
}

describe("Image upload authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireCapability.mockResolvedValue({ identityId: "id-1" });
    mocks.storeImage.mockResolvedValue({ id: "image-1" });
  });

  it("checks the capability before the body is parsed", async () => {
    /*
     * request.formData() buffers the whole request into memory. When the
     * capability was only checked inside storeImage, any signed-in member
     * could make the server buffer an upload of any size before being told
     * they were not allowed to upload at all.
     */
    mocks.requireCapability.mockRejectedValue(new mocks.FakeAccessDenied());

    const form = new FormData();
    form.set("file", new File(["x"], "a.png", { type: "image/png" }));
    form.set("altText", "A picture");

    const response = await POST(upload(form));

    expect(response.status).toBe(403);
    expect(mocks.storeImage).not.toHaveBeenCalled();
  });

  it("rejects an oversized body on its declared length alone", async () => {
    const response = await POST(
      upload("ignored", { "content-length": String(50 * 1024 * 1024) }),
    );

    expect(response.status).toBe(413);
    expect(mocks.storeImage).not.toHaveBeenCalled();
  });

  it("still accepts a body with no declared length", async () => {
    // Content-Length is absent on a chunked request, so a missing header must
    // not be treated as oversized.
    const form = new FormData();
    form.set("file", new File(["x"], "a.png", { type: "image/png" }));
    form.set("altText", "A picture");

    const response = await POST(upload(form));

    expect(response.status).toBe(201);
  });

  it("surfaces a rejection reason to the uploader", async () => {
    mocks.storeImage.mockRejectedValue(
      new mocks.FakeRejected("That is not an image."),
    );

    const form = new FormData();
    form.set("file", new File(["x"], "a.svg", { type: "image/png" }));
    form.set("altText", "A picture");

    const response = await POST(upload(form));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      message: "That is not an image.",
    });
  });

  it("rejects a request with no file", async () => {
    const form = new FormData();
    form.set("altText", "A picture");

    const response = await POST(upload(form));

    expect(response.status).toBe(400);
    expect(mocks.storeImage).not.toHaveBeenCalled();
  });
});

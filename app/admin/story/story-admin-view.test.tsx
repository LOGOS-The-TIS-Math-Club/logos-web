import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StoryAdminView } from "./story-admin-view";

const image = {
  id: "76bdac42-f3f5-4c0c-a113-4f311e29b737",
  mimeType: "image/jpeg",
  byteSize: 8,
  altText: "Students at a whiteboard",
  width: 1,
  height: 1,
  createdAt: "2026-10-02T00:00:00.000Z",
};

function jsonResponse(payload: unknown, ok = true) {
  return {
    ok,
    json: async () => payload,
  };
}

describe("StoryAdminView image uploads", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function selectPendingImage() {
    fireEvent.click(screen.getByRole("button", { name: "+ Add entry" }));
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Whiteboard session" },
    });
    fireEvent.change(screen.getByLabelText("File"), {
      target: {
        files: [new File(["jpeg"], "session.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.change(screen.getByLabelText("Describe the picture"), {
      target: { value: image.altText },
    });
    return screen.getByRole("button", { name: "Add entry" });
  }

  it("uploads a pending picture before saving and attaches its returned id", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/admin/images" && !init?.method) {
          return jsonResponse({ images: [] });
        }
        if (String(input) === "/api/admin/images") {
          return jsonResponse({ image }, true);
        }
        return jsonResponse(
          {
            entry: {
              id: "entry-id",
              title: "Whiteboard session",
              body: "",
              occurredOn: "2026-10-02",
              imageId: image.id,
              published: false,
              updatedAt: "2026-10-02T00:00:00.000Z",
            },
          },
          true,
        );
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<StoryAdminView initialEntries={[]} />);
    const save = await selectPendingImage();
    fireEvent.click(save);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/story",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining(image.id),
        }),
      ),
    );
    const uploadCall = fetchMock.mock.calls.find(
      ([input, init]) =>
        String(input) === "/api/admin/images" && init?.method === "POST",
    );
    const storyCall = fetchMock.mock.calls.find(
      ([input]) => String(input) === "/api/admin/story",
    );
    expect(uploadCall).toBeDefined();
    expect(storyCall).toBeDefined();
    const uploadIndex = fetchMock.mock.calls.findIndex(
      ([input, init]) =>
        String(input) === "/api/admin/images" && init?.method === "POST",
    );
    const storyIndex = fetchMock.mock.calls.findIndex(
      ([input]) => String(input) === "/api/admin/story",
    );
    expect(uploadIndex).toBeGreaterThanOrEqual(0);
    expect(storyIndex).toBeGreaterThan(uploadIndex);
    expect(JSON.parse(String(storyCall?.[1]?.body)).imageId).toBe(image.id);
  });

  it("does not save the story when the pending picture upload fails", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === "/api/admin/images" && !init?.method) {
          return jsonResponse({ images: [] });
        }
        return jsonResponse({ message: "Upload unavailable" }, false);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<StoryAdminView initialEntries={[]} />);
    fireEvent.click(await selectPendingImage());

    expect(await screen.findAllByText("Upload unavailable")).toHaveLength(2);
    expect(
      fetchMock.mock.calls.some(
        ([input]) => String(input) === "/api/admin/story",
      ),
    ).toBe(false);
  });
});

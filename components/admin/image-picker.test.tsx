import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImagePicker } from "./image-picker";

describe("ImagePicker", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("shows the selected image even when the library cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(
      <ImagePicker
        value="76bdac42-f3f5-4c0c-a113-4f311e29b737"
        onChange={() => {}}
      />,
    );

    const image = await screen.findByAltText("");
    expect(image).toHaveAttribute(
      "src",
      "/api/images/76bdac42-f3f5-4c0c-a113-4f311e29b737",
    );
  });
});

import { describe, expect, test, vi } from "vitest";

import { DriveMetadataService } from "./drive.server";

const tokenProvider = {
  getAccessToken: vi.fn().mockResolvedValue("controlled"),
};

describe("DriveMetadataService", () => {
  test("requests only projected metadata for an allowlisted resource", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "file_123",
          name: "Synthetic handbook",
          mimeType: "application/pdf",
          webViewLink: "https://drive.google.com/file/d/file_123/view",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const service = new DriveMetadataService(
      { handbook: "file_123" },
      tokenProvider,
      1000,
      fetcher,
    );
    await expect(service.get("handbook")).resolves.toMatchObject({
      id: "file_123",
      name: "Synthetic handbook",
    });
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get("fields")).toBe("id,name,mimeType,webViewLink");
    expect(fetcher.mock.calls[0][1]?.method).toBeUndefined();
    expect(String(fetcher.mock.calls[0][0])).not.toMatch(
      /alt=media|export|permissions/,
    );
  });

  test("denies arbitrary IDs before making a request", async () => {
    const fetcher = vi.fn();
    const service = new DriveMetadataService({}, tokenProvider, 1000, fetcher);
    await expect(service.get("attacker-selected-id")).rejects.toThrow(
      "drive_resource_unavailable",
    );
    expect(fetcher).not.toHaveBeenCalled();
  });

  test("rejects invalid provider data and permission failures", async () => {
    const invalid = new DriveMetadataService(
      { handbook: "file_123" },
      tokenProvider,
      1000,
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ id: "different" }), { status: 200 }),
        ),
    );
    const denied = new DriveMetadataService(
      { handbook: "file_123" },
      tokenProvider,
      1000,
      vi.fn().mockResolvedValue(new Response("{}", { status: 403 })),
    );
    await expect(invalid.get("handbook")).rejects.toThrow();
    await expect(denied.get("handbook")).rejects.toMatchObject({
      code: "permission_denied",
      retryable: false,
    });
  });
});

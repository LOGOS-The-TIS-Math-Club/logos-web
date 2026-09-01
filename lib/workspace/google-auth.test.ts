import { describe, expect, test, vi } from "vitest";

import { RefreshTokenProvider } from "./google-auth.server";

describe("Google token boundary", () => {
  test("validates token responses and sends credentials only to the token endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "controlled-access-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        { status: 200 },
      ),
    );
    const provider = new RefreshTokenProvider(
      {
        clientId: "controlled-client",
        clientSecret: "controlled-secret",
        refreshToken: "controlled-refresh",
      },
      fetcher,
    );
    await expect(
      provider.getAccessToken(AbortSignal.timeout(1000)),
    ).resolves.toBe("controlled-access-token");
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://oauth2.googleapis.com/token",
    );
    expect(fetcher.mock.calls[0][1]?.body).toBeInstanceOf(URLSearchParams);
  });

  test("returns a bounded error for invalid token responses", async () => {
    const provider = new RefreshTokenProvider(
      {
        clientId: "controlled-client",
        clientSecret: "controlled-secret",
        refreshToken: "controlled-refresh",
      },
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: "bad" }))),
    );
    await expect(
      provider.getAccessToken(AbortSignal.timeout(1000)),
    ).rejects.toMatchObject({
      code: "provider_invalid_response",
      message: "provider_invalid_response",
    });
  });
});

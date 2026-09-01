import "server-only";

import { importPKCS8, SignJWT } from "jose";
import { z } from "zod";

import {
  failureForStatus,
  fetchWithTimeout,
  ProviderFailure,
  readJson,
  type AccessTokenProvider,
} from "./provider.server";

const TokenResponse = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  token_type: z.literal("Bearer"),
});
const ServiceAccount = z.object({
  clientEmail: z.string().email(),
  privateKey: z.string().includes("BEGIN PRIVATE KEY"),
  scope: z.string().url(),
});

async function requestToken(
  body: URLSearchParams,
  signal: AbortSignal,
  fetcher: typeof fetch,
): Promise<string> {
  const response = await fetchWithTimeout(
    "https://oauth2.googleapis.com/token",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal,
    },
    10_000,
    fetcher,
  );
  if (!response.ok) throw failureForStatus(response.status);
  const parsed = TokenResponse.safeParse(await readJson(response));
  if (!parsed.success)
    throw new ProviderFailure("provider_invalid_response", false);
  return parsed.data.access_token;
}

export class ServiceAccountTokenProvider implements AccessTokenProvider {
  constructor(
    private readonly input: z.input<typeof ServiceAccount>,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = () => Math.floor(Date.now() / 1000),
  ) {}

  async getAccessToken(signal: AbortSignal): Promise<string> {
    const config = ServiceAccount.safeParse(this.input);
    if (!config.success)
      throw new ProviderFailure("configuration_invalid", false);
    const issuedAt = this.now();
    let assertion: string;
    try {
      const key = await importPKCS8(
        config.data.privateKey.replace(/\\n/g, "\n"),
        "RS256",
      );
      assertion = await new SignJWT({ scope: config.data.scope })
        .setProtectedHeader({ alg: "RS256", typ: "JWT" })
        .setIssuer(config.data.clientEmail)
        .setAudience("https://oauth2.googleapis.com/token")
        .setIssuedAt(issuedAt)
        .setExpirationTime(issuedAt + 3600)
        .sign(key);
    } catch {
      throw new ProviderFailure("configuration_invalid", false);
    }
    return requestToken(
      new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }),
      signal,
      this.fetcher,
    );
  }
}

const RefreshToken = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  refreshToken: z.string().min(1),
});

export class RefreshTokenProvider implements AccessTokenProvider {
  constructor(
    private readonly input: z.input<typeof RefreshToken>,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async getAccessToken(signal: AbortSignal): Promise<string> {
    const config = RefreshToken.safeParse(this.input);
    if (!config.success)
      throw new ProviderFailure("configuration_invalid", false);
    return requestToken(
      new URLSearchParams({
        client_id: config.data.clientId,
        client_secret: config.data.clientSecret,
        refresh_token: config.data.refreshToken,
        grant_type: "refresh_token",
      }),
      signal,
      this.fetcher,
    );
  }
}

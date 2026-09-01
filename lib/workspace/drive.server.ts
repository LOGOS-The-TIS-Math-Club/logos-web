import "server-only";

import { z } from "zod";

import {
  failureForStatus,
  fetchWithTimeout,
  ProviderFailure,
  readJson,
  type AccessTokenProvider,
} from "./provider.server";

const DriveFile = z.object({
  id: z.string().min(1).max(1024),
  name: z.string().min(1).max(1000),
  mimeType: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i),
  webViewLink: z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        (url.hostname === "drive.google.com" ||
          url.hostname.endsWith(".drive.google.com") ||
          url.hostname === "docs.google.com" ||
          url.hostname.endsWith(".docs.google.com"))
      );
    }),
});
export type DriveResource = z.infer<typeof DriveFile>;

export class DriveMetadataService {
  constructor(
    private readonly allowed: Readonly<Record<string, string>>,
    private readonly tokens: AccessTokenProvider,
    private readonly timeoutMs = 5000,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async get(key: string): Promise<DriveResource> {
    const id = this.allowed[key];
    if (!id) throw new Error("drive_resource_unavailable");
    const signal = AbortSignal.timeout(this.timeoutMs);
    const token = await this.tokens.getAccessToken(signal);
    const url = new URL(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}`,
    );
    url.search = new URLSearchParams({
      fields: "id,name,mimeType,webViewLink",
      supportsAllDrives: "true",
    }).toString();
    const response = await fetchWithTimeout(
      url,
      { headers: { authorization: `Bearer ${token}` }, signal },
      this.timeoutMs,
      this.fetcher,
    );
    if (!response.ok) throw failureForStatus(response.status);
    const parsed = DriveFile.safeParse(await readJson(response));
    if (!parsed.success || parsed.data.id !== id)
      throw new ProviderFailure("provider_invalid_response", false);
    return parsed.data;
  }
}

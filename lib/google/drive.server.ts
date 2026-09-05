import "server-only";

import { createSign } from "node:crypto";

import {
  type DriveFile,
  base64url,
  buildFilesUrl,
  buildJwtClaims,
  DRIVE_UPLOAD_ENDPOINT,
  mapDriveFiles,
  normalisePrivateKey,
  TOKEN_ENDPOINT,
} from "./drive-protocol";

/*
 * Google Drive access for the club account.
 *
 * Used for two things: listing the materials attached to a session, and
 * writing the data export to the club's Drive as a backup.
 *
 * Everything here is optional. When the service account is not configured the
 * client reports that plainly and callers show a "not connected" state, so the
 * site works exactly as before until the school grants the API access
 * requested in docs/drafts/workspace-api-request.md.
 *
 * Implemented against the REST API with a hand-built assertion rather than
 * pulling in googleapis: the whole surface used here is two endpoints, and the
 * dependency is large enough to be worth avoiding for that.
 */

export class DriveNotConfiguredError extends Error {
  constructor() {
    super("Google Drive is not configured");
    this.name = "DriveNotConfiguredError";
  }
}

export class DriveRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DriveRequestError";
  }
}

interface DriveConfig {
  clientEmail: string;
  privateKey: string;
  subject: string | null;
  backupFolderId: string | null;
}

export function readDriveConfig(
  environment: NodeJS.ProcessEnv = process.env,
): DriveConfig | null {
  const clientEmail =
    environment.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = environment.GOOGLE_WORKSPACE_PRIVATE_KEY?.trim();

  if (!clientEmail || !privateKey) return null;

  return {
    clientEmail,
    privateKey: normalisePrivateKey(privateKey),
    // Domain-wide delegation: act as the club mailbox rather than as the bare
    // service account, so files are owned by the club.
    subject: environment.GOOGLE_WORKSPACE_SUBJECT?.trim() || null,
    backupFolderId: environment.GOOGLE_DRIVE_BACKUP_FOLDER_ID?.trim() || null,
  };
}

export function isDriveConfigured(
  environment: NodeJS.ProcessEnv = process.env,
): boolean {
  return readDriveConfig(environment) !== null;
}

/*
 * Access tokens last an hour. Caching one avoids a token round trip on every
 * page view; the 60s margin means a token is never used in the seconds before
 * it expires.
 */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(config: DriveConfig): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify(buildJwtClaims(config.clientEmail, now, config.subject)),
  );
  const signingInput = `${header}.${claims}`;

  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .sign(config.privateKey);
  const assertion = `${signingInput}.${base64url(signature)}`;

  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    // Deliberately does not include the body: Google echoes parts of the
    // assertion in errors, and this message reaches logs.
    throw new DriveRequestError(
      response.status,
      "Google rejected the service account assertion",
    );
  }

  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!payload.access_token) {
    throw new DriveRequestError(502, "Google returned no access token");
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: now + (payload.expires_in ?? 3600) * 1000,
  };

  return cachedToken.value;
}

/** Files directly inside a Drive folder. */
export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  const config = readDriveConfig();
  if (!config) throw new DriveNotConfiguredError();

  const token = await getAccessToken(config);
  const response = await fetch(buildFilesUrl(folderId), {
    headers: { Authorization: `Bearer ${token}` },
    // These listings change when leadership adds a file, not per request, but
    // they are also members-only. Never cache them at the edge.
    cache: "no-store",
  });

  if (!response.ok) {
    throw new DriveRequestError(
      response.status,
      `Drive listing failed (${response.status})`,
    );
  }

  return mapDriveFiles(await response.json());
}

/**
 * Writes a file into the configured backup folder.
 *
 * Multipart upload, built by hand because the boundary has to appear both in
 * the body and in the Content-Type header.
 */
export async function uploadBackupFile(
  name: string,
  mimeType: string,
  content: string,
): Promise<{ id: string }> {
  const config = readDriveConfig();
  if (!config) throw new DriveNotConfiguredError();
  if (!config.backupFolderId) {
    throw new DriveNotConfiguredError();
  }

  const token = await getAccessToken(config);
  const boundary = `logos-${crypto.randomUUID()}`;
  const metadata = {
    name,
    parents: [config.backupFolderId],
  };

  const body = [
    `--${boundary}`,
    "Content-Type: application/json; charset=UTF-8",
    "",
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${mimeType}; charset=UTF-8`,
    "",
    content,
    `--${boundary}--`,
    "",
  ].join("\r\n");

  const url = new URL(DRIVE_UPLOAD_ENDPOINT);
  url.searchParams.set("uploadType", "multipart");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("fields", "id");

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!response.ok) {
    throw new DriveRequestError(
      response.status,
      `Drive upload failed (${response.status})`,
    );
  }

  const payload = (await response.json()) as { id?: string };
  if (!payload.id)
    throw new DriveRequestError(502, "Drive returned no file id");

  return { id: payload.id };
}

/** Test seam: drops the cached access token. */
export function resetDriveTokenCache(): void {
  cachedToken = null;
}

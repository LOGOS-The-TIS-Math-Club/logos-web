/*
 * The parts of the Drive integration that are pure.
 *
 * Kept apart from the client so query construction, claim building and
 * response mapping can be tested without a service account, a network, or a
 * private key.
 */

export const DRIVE_SCOPES = [
  // Listing a session's materials.
  "https://www.googleapis.com/auth/drive.readonly",
  // Writing backups. drive.file limits writes to files this integration
  // created, which is the narrowest scope that can still upload.
  "https://www.googleapis.com/auth/drive.file",
] as const;

export const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
export const DRIVE_UPLOAD_ENDPOINT =
  "https://www.googleapis.com/upload/drive/v3/files";

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  /** Drive's own viewer link. Null when Drive did not return one. */
  webViewLink: string | null;
  modifiedTime: string | null;
  size: number | null;
}

/**
 * Escapes a folder id for use inside a Drive query string literal.
 *
 * Drive's `q` syntax is its own little language, and an id is interpolated
 * into a single-quoted literal. An id containing a quote or a backslash would
 * otherwise break out of that literal and change the query — the same shape of
 * bug as SQL injection, in a place people rarely think to look.
 */
export function escapeDriveLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Files directly inside a folder, excluding anything trashed. */
export function buildFolderQuery(folderId: string): string {
  return `'${escapeDriveLiteral(folderId)}' in parents and trashed = false`;
}

export function buildFilesUrl(folderId: string): string {
  const url = new URL(DRIVE_FILES_ENDPOINT);
  url.searchParams.set("q", buildFolderQuery(folderId));
  url.searchParams.set(
    "fields",
    "files(id,name,mimeType,webViewLink,modifiedTime,size)",
  );
  url.searchParams.set("orderBy", "name");
  // Enough for a session's materials; a folder with more than this is not the
  // shape this feature is for.
  url.searchParams.set("pageSize", "100");
  // Required for files that live in a shared drive.
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("includeItemsFromAllDrives", "true");
  return url.toString();
}

/**
 * Maps one Drive API file object into the shape the UI renders.
 *
 * Everything is treated as optional because the API omits fields rather than
 * nulling them — `size` is absent for folders and Google-native documents, and
 * `webViewLink` can be absent entirely.
 */
export function mapDriveFile(raw: unknown): DriveFile | null {
  if (typeof raw !== "object" || raw === null) return null;
  const file = raw as Record<string, unknown>;
  if (typeof file.id !== "string" || typeof file.name !== "string") return null;

  const size = typeof file.size === "string" ? Number(file.size) : null;

  return {
    id: file.id,
    name: file.name,
    mimeType:
      typeof file.mimeType === "string"
        ? file.mimeType
        : "application/octet-stream",
    webViewLink: typeof file.webViewLink === "string" ? file.webViewLink : null,
    modifiedTime:
      typeof file.modifiedTime === "string" ? file.modifiedTime : null,
    size: size !== null && Number.isFinite(size) ? size : null,
  };
}

export function mapDriveFiles(payload: unknown): DriveFile[] {
  if (typeof payload !== "object" || payload === null) return [];
  const files = (payload as Record<string, unknown>).files;
  if (!Array.isArray(files)) return [];
  return files
    .map(mapDriveFile)
    .filter((file): file is DriveFile => file !== null);
}

export interface JwtClaims {
  iss: string;
  scope: string;
  aud: string;
  exp: number;
  iat: number;
  sub?: string;
}

/**
 * Builds the assertion claims for a service-account token request.
 *
 * `sub` is set only when impersonating a user through domain-wide delegation.
 * Google rejects the assertion outright if `sub` is present but empty, so it
 * is omitted rather than sent blank.
 */
export function buildJwtClaims(
  clientEmail: string,
  now: number,
  subject?: string | null,
): JwtClaims {
  const issuedAt = Math.floor(now / 1000);
  const claims: JwtClaims = {
    iss: clientEmail,
    scope: DRIVE_SCOPES.join(" "),
    aud: TOKEN_ENDPOINT,
    iat: issuedAt,
    // Google's ceiling for an assertion is one hour.
    exp: issuedAt + 3600,
  };
  if (subject) claims.sub = subject;
  return claims;
}

/** Base64url without padding, as JWS requires. */
export function base64url(input: Buffer | string): string {
  return (typeof input === "string" ? Buffer.from(input) : input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Restores a PEM private key that has passed through an environment variable.
 *
 * Most secret stores and CI systems cannot hold a literal newline, so the key
 * arrives with "\n" written out. Without this the key parses as garbage and
 * the failure looks like an authentication problem rather than a formatting
 * one.
 */
export function normalisePrivateKey(raw: string): string {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

import {
  buildFolderViewUrl,
  safeDriveViewUrl,
  type DriveFile,
} from "@/lib/google/drive-protocol";

function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SessionMaterials({
  folderId,
  driveConfigured,
  driveError,
  files,
}: {
  folderId: string | null;
  driveConfigured: boolean;
  driveError: boolean;
  files: DriveFile[];
}) {
  if (!folderId) {
    return (
      <p className="text-muted-foreground text-sm">
        No materials folder has been attached to this session.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <a
        href={buildFolderViewUrl(folderId)}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-visible:outline-focus inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4 focus-visible:outline-2"
      >
        Open session folder in Google Drive
        <span aria-hidden="true">↗</span>
      </a>

      {!driveConfigured ? (
        <p className="text-muted-foreground text-sm">
          The file list is unavailable here because Drive is not connected. You
          can still open the folder above if you have access.
        </p>
      ) : driveError ? (
        <p className="text-muted-foreground text-sm">
          The file list could not be loaded from Drive just now. You can still
          open the folder above, or try again shortly.
        </p>
      ) : files.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          The folder for this session is empty.
        </p>
      ) : (
        <ul className="border-border divide-border divide-y border-t border-b">
          {files.map((file) => (
            <li key={file.id}>
              <a
                href={safeDriveViewUrl(file.webViewLink, file.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:bg-surface focus-visible:outline-focus flex items-baseline justify-between gap-4 px-2 py-3 transition-colors focus-visible:outline-2"
              >
                <span className="text-sm">{file.name}</span>
                <span className="text-subtle-foreground shrink-0 text-xs">
                  {formatSize(file.size)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

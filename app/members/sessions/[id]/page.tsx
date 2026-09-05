import Link from "next/link";
import { notFound } from "next/navigation";

import { AppPage } from "@/components/layout/app-page";
import { getClubSessionById } from "@/lib/attendance/service.server";
import { type DriveFile } from "@/lib/google/drive-protocol";
import { isDriveConfigured, listFolderFiles } from "@/lib/google/drive.server";
import { getCurrentMember } from "@/lib/membership/service.server";

export const dynamic = "force-dynamic";

function formatSize(bytes: number | null): string {
  if (bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function MemberSessionPage(context: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await context.params;

  /*
   * Membership is checked before anything else. Session materials are for
   * members, and the file listing must not be reachable by anyone else even
   * though Drive would enforce its own permissions on the files themselves.
   */
  const member = await getCurrentMember();
  if (!member) notFound();

  const session = await getClubSessionById(id);
  if (!session) notFound();

  let files: DriveFile[] = [];
  let driveError = false;
  const driveConfigured = isDriveConfigured();

  if (session.driveFolderId && driveConfigured) {
    try {
      files = await listFolderFiles(session.driveFolderId);
    } catch {
      // A Drive outage should not take the session page down with it.
      driveError = true;
    }
  }

  return (
    <AppPage
      width="narrow"
      eyebrow={session.sessionDate}
      title={session.title}
      lede={`${session.startTime}–${session.endTime} · ${session.location}`}
    >
      <Link
        href="/members"
        className="text-muted-foreground hover:text-foreground text-xs font-semibold"
      >
        ← Member hub
      </Link>

      {session.notes ? (
        <div className="panel ruled-left space-y-2 border-l-2 p-6">
          <h2 className="heading-3">Notes</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {session.notes}
          </p>
        </div>
      ) : null}

      <section aria-labelledby="materials-heading" className="space-y-4">
        <h2 id="materials-heading" className="heading-3">
          Materials
        </h2>

        {!session.driveFolderId ? (
          <p className="text-muted-foreground text-sm">
            No materials folder has been attached to this session.
          </p>
        ) : !driveConfigured ? (
          <p className="text-muted-foreground text-sm">
            Drive is not connected yet, so files cannot be listed here. Ask
            leadership for the folder link in the meantime.
          </p>
        ) : driveError ? (
          <p className="text-muted-foreground text-sm">
            The materials could not be loaded from Drive just now. Please try
            again shortly.
          </p>
        ) : files.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            The folder for this session is empty.
          </p>
        ) : (
          <ul className="border-border divide-border divide-y border-t border-b">
            {files.map((file) => (
              <li key={file.id}>
                {/*
                 * Links out to Drive rather than proxying the file. Drive's own
                 * permissions stay the only thing deciding who can open it, so
                 * this page can never hand a member a file the school has not
                 * shared with them.
                 */}
                <a
                  href={
                    file.webViewLink ??
                    `https://drive.google.com/file/d/${file.id}/view`
                  }
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
      </section>
    </AppPage>
  );
}

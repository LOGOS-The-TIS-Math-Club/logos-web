import Link from "next/link";
import { notFound } from "next/navigation";

import { AppPage } from "@/components/layout/app-page";
import { getClubSessionById } from "@/lib/attendance/service.server";
import { type DriveFile } from "@/lib/google/drive-protocol";
import { isDriveConfigured, listFolderFiles } from "@/lib/google/drive.server";
import { getCurrentMember } from "@/lib/membership/service.server";
import { SessionMaterials } from "../session-materials";

export const dynamic = "force-dynamic";

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

        <SessionMaterials
          folderId={session.driveFolderId}
          driveConfigured={driveConfigured}
          driveError={driveError}
          files={files}
        />
      </section>
    </AppPage>
  );
}

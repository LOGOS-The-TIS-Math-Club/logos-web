import { headers } from "next/headers";

import { listAnnouncementsForManagement } from "@/lib/announcements/service.server";
import type { AnnouncementRecord } from "@/lib/announcements/schema";
import { AccessDeniedError } from "@/lib/auth/errors";
import { CORRELATION_HEADER_NAME } from "@/lib/security/correlation";

import { AnnouncementsAdminView } from "./announcements-admin-view";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const correlationId =
    (await headers()).get(CORRELATION_HEADER_NAME) || crypto.randomUUID();

  // Data fetching stays inside the try; the JSX is built after it, so a render
  // error is never swallowed by this catch.
  let announcements: AnnouncementRecord[] | null = null;
  let accessDenied = false;

  try {
    announcements = await listAnnouncementsForManagement(correlationId);
  } catch (error) {
    accessDenied = error instanceof AccessDeniedError;
  }

  if (accessDenied || announcements === null) {
    return (
      <div className="mx-auto max-w-lg space-y-3 py-16 text-center">
        <h1 className="text-danger text-xl font-bold">
          {accessDenied ? "403 • Access denied" : "Service unavailable"}
        </h1>
        <p className="text-muted-foreground text-sm">
          {accessDenied
            ? "You do not have the announcement:manage capability."
            : "The announcement list could not be loaded."}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 py-4">
      <header className="space-y-3">
        <p className="eyebrow">Leadership</p>
        <h1 className="text-3xl font-extrabold tracking-[-0.03em]">
          Announcements
        </h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Published announcements appear on the home page as soon as you save.
          Drafts stay private until you tick publish.
        </p>
      </header>

      <AnnouncementsAdminView announcements={announcements} />
    </div>
  );
}

import Link from "next/link";

import {
  getMemberAttendanceTotals,
  listClubSessions,
} from "@/lib/attendance/service.server";
import { getCurrentMember } from "@/lib/membership/service.server";
import { MemberHubView } from "./member-hub-view";

export const dynamic = "force-dynamic";

export default async function MembersPage() {
  const member = await getCurrentMember();

  if (!member) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <div className="border-border bg-surface rounded-component space-y-4 border p-8">
          <div className="border-border bg-surface-raised mx-auto inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold text-primary">
            <span>Members Hub</span>
          </div>

          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            LOGOS Member Portal
          </h1>

          <p className="text-muted-foreground text-sm leading-relaxed">
            The member hub provides meeting schedules, absence notifications, and club materials for active LOGOS members.
          </p>

          <div className="border-border bg-surface-raised/50 rounded-component border p-4 text-left text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Getting Access:</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>
                <strong>New student?</strong> Submit an application at our recruitment page.
              </li>
              <li>
                <strong>Already accepted?</strong> Club leadership will activate your membership following review.
              </li>
              <li>
                <strong>Current member?</strong> Ensure you are signed in with your verified <code>@tokyois.com</code> Google account.
              </li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/apply"
              className="bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active rounded-component focus-visible:outline-focus inline-flex min-h-10 items-center justify-center px-5 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Apply to LOGOS
            </Link>
            <Link
              href="/auth/sign-in"
              className="border-border bg-surface text-foreground hover:bg-surface-raised rounded-component focus-visible:outline-focus inline-flex min-h-10 items-center justify-center border px-4 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const sessions = await listClubSessions();
  const upcomingSession = sessions[0] || null;
  const totals = await getMemberAttendanceTotals(member.id);

  return (
    <MemberHubView
      member={member}
      upcomingSession={upcomingSession}
      attendanceTotals={totals}
    />
  );
}

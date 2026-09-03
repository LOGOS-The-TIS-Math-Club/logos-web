import Link from "next/link";

import { AppPage } from "@/components/layout/app-page";

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
      <AppPage
        width="narrow"
        eyebrow="Members"
        title="Member hub"
        lede="Meeting schedules, absence notices and club materials for active LOGOS members."
      >
        <div className="panel ruled-left space-y-4 border-l-2 p-6 sm:p-8">
          <p className="heading-3">You are not an active member yet</p>
          <ul className="text-muted-foreground space-y-2 text-sm leading-relaxed">
            <li>
              <strong className="text-foreground">New student?</strong> Submit
              an application and leadership will review it.
            </li>
            <li>
              <strong className="text-foreground">Already accepted?</strong>{" "}
              Leadership activates your membership after review — it is a
              separate, deliberate step.
            </li>
            <li>
              <strong className="text-foreground">Current member?</strong> Make
              sure you are signed in with your verified{" "}
              <code>@tokyois.com</code> account.
            </li>
          </ul>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/apply" className="action action-primary">
            <span className="action-label">Apply to LOGOS</span>
            <span className="action-label-hover" aria-hidden="true">
              Apply to LOGOS
            </span>
          </Link>
          <Link href="/auth/sign-in" className="action">
            <span className="action-label">Sign in</span>
            <span className="action-label-hover" aria-hidden="true">
              Sign in
            </span>
          </Link>
        </div>
      </AppPage>
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

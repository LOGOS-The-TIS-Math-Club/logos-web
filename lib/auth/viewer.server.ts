import "server-only";

import { and, eq } from "drizzle-orm";

import { clubMembers } from "@/db/schema";
import { withDatabase } from "@/lib/db/client.server";

import { hasCapability } from "./capabilities";
import { resolveCurrentIdentity } from "./identity-access.server";
import { getNeonAuth, isNeonAuthConfigured } from "./neon.server";

/*
 * Who is looking at the page, for presentation only.
 *
 * The shell needs just enough to decide between "Apply" and a profile control.
 * Nothing here authorises anything: every protected route and action still runs
 * its own requireCapability check server-side. Treat this as a hint for what to
 * draw, never as a permission.
 *
 * It must never throw. It runs in the root layout on every request, including
 * public pages and environments where auth is not configured at all, so any
 * failure resolves to "anonymous" and the site renders as it always has.
 */
export interface Viewer {
  readonly email: string;
  /** Google profile picture from the OAuth session; null if Google sent none. */
  readonly avatarUrl: string | null;
  /** True only for an active club member — this is what hides "Apply". */
  readonly isMember: boolean;
  readonly isLeadership: boolean;
}

export async function getViewer(): Promise<Viewer | null> {
  if (!isNeonAuthConfigured()) return null;

  try {
    const session = (await getNeonAuth().getSession()).data;
    if (!session?.user) return null;

    const identity = await resolveCurrentIdentity();

    const [member] = await withDatabase((database) =>
      database
        .select({ id: clubMembers.id })
        .from(clubMembers)
        .where(
          and(
            eq(clubMembers.identityId, identity.identityId),
            eq(clubMembers.status, "active"),
          ),
        )
        .limit(1),
    );

    return {
      email: identity.email,
      avatarUrl: session.user.image ?? null,
      isMember:
        Boolean(member) &&
        identity.active &&
        identity.affiliationStatus === "verified",
      isLeadership: hasCapability(identity.accessLevel, "application:review"),
    };
  } catch {
    return null;
  }
}

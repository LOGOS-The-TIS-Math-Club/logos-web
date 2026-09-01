import { headers } from "next/headers";
import { and, eq, notInArray } from "drizzle-orm";

import {
  applicationIdentities,
  clubMembers,
  studentApplications,
} from "@/db/schema";
import {
  AccessDeniedError,
  requireCapability,
} from "@/lib/auth/identity-access.server";
import { withDatabase } from "@/lib/db/client.server";
import { listMembers } from "@/lib/membership/service.server";
import {
  type AcceptedApplicationItem,
  MemberAdminView,
} from "./member-admin-view";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const requestHeaders = await headers();
  const correlationId =
    requestHeaders.get("x-correlation-id") || crypto.randomUUID();

  let members = null;
  let acceptedApps: AcceptedApplicationItem[] = [];
  let accessDenied = false;
  let serviceError = false;

  try {
    await requireCapability("membership:read", correlationId);
    members = await listMembers(correlationId);

    // Fetch accepted applications that don't have an active membership
    acceptedApps = await withDatabase(async (database) => {
      const activeMemberIdentityIds = await database
        .select({ identityId: clubMembers.identityId })
        .from(clubMembers)
        .where(eq(clubMembers.status, "active"));

      const excludedIds = activeMemberIdentityIds.map((m) => m.identityId);

      let query = database
        .select({
          id: studentApplications.id,
          identityId: studentApplications.identityId,
          preferredName: studentApplications.preferredName,
          grade: studentApplications.grade,
          submittedAt: studentApplications.submittedAt,
          email: applicationIdentities.email,
        })
        .from(studentApplications)
        .innerJoin(
          applicationIdentities,
          eq(studentApplications.identityId, applicationIdentities.id),
        )
        .where(eq(studentApplications.status, "accepted"));

      if (excludedIds.length > 0) {
        query = query.where(
          and(
            eq(studentApplications.status, "accepted"),
            notInArray(studentApplications.identityId, excludedIds),
          ),
        ) as any;
      }

      const rows = await query;
      return rows.map((r) => ({
        id: r.id,
        identityId: r.identityId,
        preferredName: r.preferredName,
        email: r.email,
        grade: r.grade,
        submittedAt: r.submittedAt.toISOString(),
      }));
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      accessDenied = true;
    } else {
      serviceError = true;
    }
  }

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <div className="border-danger bg-danger-surface rounded-component space-y-3 border p-8">
          <h1 className="text-danger text-xl font-bold">403 • Access Denied</h1>
          <p className="text-foreground text-sm leading-relaxed">
            You do not have the required <code>membership:read</code> capability
            to view club member records.
          </p>
          <p className="text-muted-foreground text-xs">
            Member records are restricted to authorized club operators.
          </p>
        </div>
      </div>
    );
  }

  if (serviceError || !members) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <div className="border-border bg-surface rounded-component space-y-3 border p-8">
          <h1 className="text-foreground text-xl font-bold">
            Service Unavailable
          </h1>
          <p className="text-muted-foreground text-sm">
            Unable to retrieve member records. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <MemberAdminView
      initialMembers={members}
      acceptedApplications={acceptedApps}
    />
  );
}

import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";

import {
  applicationIdentities,
  clubMembers,
  memberWarnings,
  studentApplications,
} from "@/db/schema";
import {
  requireCapability,
  resolveCurrentIdentity,
} from "@/lib/auth/identity-access.server";
import { withDatabase } from "@/lib/db/client.server";
import { recordBusinessAuditEvent } from "@/lib/security/audit";
import {
  type ActivateMemberInput,
  type MemberListItem,
  type UpdateDisplayNameInput,
  type UpdateMemberStatusInput,
  type UpdateRosterNameInput,
  ActivateMemberInputSchema,
  UpdateDisplayNameSchema,
  UpdateMemberStatusSchema,
  UpdateRosterNameSchema,
} from "./schema";

export class ApplicationNotAcceptedError extends Error {
  constructor(
    readonly applicationId: string,
    readonly currentStatus: string,
  ) {
    super(
      `Cannot activate membership: application status is '${currentStatus}', expected 'accepted'`,
    );
    this.name = "ApplicationNotAcceptedError";
  }
}

export class ApplicationNotFoundError extends Error {
  constructor(readonly applicationId: string) {
    super("Application not found");
    this.name = "ApplicationNotFoundError";
  }
}

export class DuplicateActiveMemberError extends Error {
  constructor(readonly identityId: string) {
    super("An active membership already exists for this verified identity");
    this.name = "DuplicateActiveMemberError";
  }
}

export class MemberNotFoundError extends Error {
  constructor(readonly memberId: string) {
    super("Club member not found");
    this.name = "MemberNotFoundError";
  }
}

/**
 * Deliberately activates an accepted student application into active club membership.
 * Requires explicit 'membership:manage' capability.
 */
export async function activateMemberFromApplication(
  rawInput: ActivateMemberInput,
  correlationId: string,
) {
  const actor = await requireCapability("membership:manage", correlationId);
  const parsedInput = ActivateMemberInputSchema.parse(rawInput);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      // 1. Fetch application
      const [application] = await transaction
        .select({
          id: studentApplications.id,
          identityId: studentApplications.identityId,
          status: studentApplications.status,
          preferredName: studentApplications.preferredName,
        })
        .from(studentApplications)
        .where(eq(studentApplications.id, parsedInput.applicationId))
        .limit(1);

      if (!application) {
        throw new ApplicationNotFoundError(parsedInput.applicationId);
      }

      if (application.status !== "accepted") {
        throw new ApplicationNotAcceptedError(
          application.id,
          application.status,
        );
      }

      // 2. Check for duplicate active membership for this identity
      const [existingActiveMember] = await transaction
        .select({ id: clubMembers.id })
        .from(clubMembers)
        .where(
          and(
            eq(clubMembers.identityId, application.identityId),
            eq(clubMembers.status, "active"),
          ),
        )
        .limit(1);

      if (existingActiveMember) {
        throw new DuplicateActiveMemberError(application.identityId);
      }

      // 3. Create active membership record
      const [member] = await transaction
        .insert(clubMembers)
        .values({
          identityId: application.identityId,
          applicationId: application.id,
          status: "active",
          statusReason:
            parsedInput.reason ||
            "Deliberately activated from accepted application",
          createdByIdentityId: actor.identityId,
        })
        .returning({
          id: clubMembers.id,
          identityId: clubMembers.identityId,
          applicationId: clubMembers.applicationId,
          status: clubMembers.status,
          joinedAt: clubMembers.joinedAt,
        });

      // 4. Record business audit event
      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "web",
        correlationId,
        category: "membership",
        action: "activate",
        targetType: "club_member",
        targetId: member.id,
        result: "success",
        reasonCode: "application_accepted_activation",
        metadata: {
          applicationId: application.id,
          identityId: application.identityId,
          preferredName: application.preferredName,
        },
      });

      return member;
    }),
  );
}

/**
 * Lists all club members with their current status, preferred names, and warning counts.
 * Requires 'membership:read' or 'membership:manage' capability.
 */
export async function listMembers(
  correlationId: string,
): Promise<MemberListItem[]> {
  await requireCapability("membership:read", correlationId);

  return withDatabase(async (database) => {
    const rows = await database
      .select({
        id: clubMembers.id,
        identityId: clubMembers.identityId,
        applicationId: clubMembers.applicationId,
        status: clubMembers.status,
        joinedAt: clubMembers.joinedAt,
        leftAt: clubMembers.leftAt,
        statusReason: clubMembers.statusReason,
        displayName: clubMembers.displayName,
        rosterName: clubMembers.rosterName,
        email: applicationIdentities.email,
        preferredName: studentApplications.preferredName,
        grade: studentApplications.grade,
      })
      .from(clubMembers)
      .innerJoin(
        applicationIdentities,
        eq(clubMembers.identityId, applicationIdentities.id),
      )
      .leftJoin(
        studentApplications,
        eq(clubMembers.applicationId, studentApplications.id),
      )
      .orderBy(desc(clubMembers.joinedAt));

    // Get active warning counts per member
    const warningCounts = await database
      .select({
        memberId: memberWarnings.memberId,
        count: sql<number>`count(*)::int`,
      })
      .from(memberWarnings)
      .where(eq(memberWarnings.active, true))
      .groupBy(memberWarnings.memberId);

    const warningMap = new Map(warningCounts.map((w) => [w.memberId, w.count]));

    return rows.map((row) => ({
      id: row.id,
      identityId: row.identityId,
      applicationId: row.applicationId,
      preferredName: row.preferredName || "Member",
      // Leadership works from the roster name; the member's own choice is
      // shown alongside it rather than replacing it.
      rosterName: row.rosterName || row.preferredName || "Member",
      displayName: row.displayName,
      email: row.email,
      grade: row.grade,
      status: row.status,
      joinedAt: row.joinedAt.toISOString(),
      leftAt: row.leftAt ? row.leftAt.toISOString() : null,
      statusReason: row.statusReason,
      warningCount: warningMap.get(row.id) || 0,
    }));
  });
}

/**
 * Updates a member's status (active, inactive, former) with reason.
 * Requires 'membership:manage' capability.
 */
export async function updateMemberStatus(
  memberId: string,
  rawInput: UpdateMemberStatusInput,
  correlationId: string,
) {
  const actor = await requireCapability("membership:manage", correlationId);
  const parsedInput = UpdateMemberStatusSchema.parse(rawInput);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(clubMembers)
        .where(eq(clubMembers.id, memberId))
        .limit(1);

      if (!existing) {
        throw new MemberNotFoundError(memberId);
      }

      const isLeaving = parsedInput.status !== "active";
      const leftAtValue = isLeaving ? existing.leftAt || new Date() : null;

      const [updated] = await transaction
        .update(clubMembers)
        .set({
          status: parsedInput.status,
          statusReason: parsedInput.reason || existing.statusReason,
          leftAt: leftAtValue,
          updatedAt: new Date(),
        })
        .where(eq(clubMembers.id, memberId))
        .returning();

      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "web",
        correlationId,
        category: "membership",
        action: "status_update",
        targetType: "club_member",
        targetId: memberId,
        result: "success",
        beforeSummary: { status: existing.status },
        afterSummary: { status: parsedInput.status },
        metadata: {
          reason: parsedInput.reason,
        },
      });

      return updated;
    }),
  );
}

/**
 * Resolves active club membership for the currently signed-in user.
 * Returns member info or null if user is not an active member.
 */
/**
 * A member renaming themselves.
 *
 * No capability check: this writes the caller's own row and nothing else. The
 * WHERE clause is scoped to the resolved identity and to an active membership,
 * so a member cannot rename anyone but themselves even if they send another
 * member's id — there is no id to send.
 */
export async function updateOwnDisplayName(
  rawInput: UpdateDisplayNameInput,
  correlationId: string,
) {
  const identity = await resolveCurrentIdentity();
  if (!identity.active || identity.affiliationStatus !== "verified") {
    throw new MemberNotFoundError("self");
  }

  const { displayName } = UpdateDisplayNameSchema.parse(rawInput);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(clubMembers)
        .set({ displayName, updatedAt: new Date() })
        .where(
          and(
            eq(clubMembers.identityId, identity.identityId),
            eq(clubMembers.status, "active"),
          ),
        )
        .returning();

      if (!updated) throw new MemberNotFoundError("self");

      await recordBusinessAuditEvent(transaction, {
        actorId: identity.identityId,
        actorType: "user",
        actorRoleSnapshot: "member",
        source: "web",
        correlationId,
        category: "membership",
        action: "update_display_name",
        targetType: "club_member",
        targetId: updated.id,
        result: "success",
      });

      return updated;
    }),
  );
}

/**
 * Leadership setting the name they work from. Requires 'membership:manage'.
 *
 * Writes rosterName only, so correcting the roster never overwrites the name a
 * member chose for themselves. Passing null clears the override and falls the
 * roster back to the name on the application.
 */
export async function updateMemberRosterName(
  memberId: string,
  rawInput: UpdateRosterNameInput,
  correlationId: string,
) {
  const actor = await requireCapability("membership:manage", correlationId);
  const { rosterName } = UpdateRosterNameSchema.parse(rawInput);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(clubMembers)
        .where(eq(clubMembers.id, memberId))
        .limit(1);

      if (!existing) throw new MemberNotFoundError(memberId);

      const [updated] = await transaction
        .update(clubMembers)
        .set({ rosterName, updatedAt: new Date() })
        .where(eq(clubMembers.id, memberId))
        .returning();

      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "web",
        correlationId,
        category: "membership",
        action: "update_roster_name",
        targetType: "club_member",
        targetId: memberId,
        result: "success",
        beforeSummary: { rosterName: existing.rosterName },
        afterSummary: { rosterName: updated.rosterName },
      });

      return updated;
    }),
  );
}

export async function getCurrentMember() {
  try {
    const identity = await resolveCurrentIdentity();
    if (!identity.active || identity.affiliationStatus !== "verified") {
      return null;
    }

    return withDatabase(async (database) => {
      const [member] = await database
        .select({
          id: clubMembers.id,
          identityId: clubMembers.identityId,
          applicationId: clubMembers.applicationId,
          status: clubMembers.status,
          joinedAt: clubMembers.joinedAt,
          displayName: clubMembers.displayName,
          preferredName: studentApplications.preferredName,
          grade: studentApplications.grade,
          email: applicationIdentities.email,
        })
        .from(clubMembers)
        .innerJoin(
          applicationIdentities,
          eq(clubMembers.identityId, applicationIdentities.id),
        )
        .leftJoin(
          studentApplications,
          eq(clubMembers.applicationId, studentApplications.id),
        )
        .where(
          and(
            eq(clubMembers.identityId, identity.identityId),
            eq(clubMembers.status, "active"),
          ),
        )
        .limit(1);

      if (!member) return null;

      return {
        id: member.id,
        identityId: member.identityId,
        applicationId: member.applicationId,
        status: member.status,
        joinedAt: member.joinedAt.toISOString(),
        preferredName: member.preferredName || "Member",
        // Member-facing surfaces use the name the member chose.
        displayName: member.displayName || member.preferredName || "Member",
        grade: member.grade,
        email: member.email,
      };
    });
  } catch {
    return null;
  }
}

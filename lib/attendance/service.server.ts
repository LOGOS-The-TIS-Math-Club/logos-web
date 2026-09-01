import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import {
  applicationIdentities,
  clubMembers,
  clubSessions,
  expectedAbsences,
  memberWarnings,
  sessionAttendance,
  studentApplications,
} from "@/db/schema";
import {
  AccessDeniedError,
  requireCapability,
  resolveCurrentIdentity,
} from "@/lib/auth/identity-access.server";
import { withDatabase } from "@/lib/db/client.server";
import { recordBusinessAuditEvent } from "@/lib/security/audit";
import {
  type CreateSessionInput,
  type IssueWarningInput,
  type MemberSessionAttendance,
  type RecordAttendanceItem,
  type SessionListItem,
  type SubmitExpectedAbsenceInput,
  type WarningListItem,
  type AttendanceTotals,
  CreateSessionSchema,
  IssueWarningSchema,
  RecordAttendanceBatchSchema,
  SubmitExpectedAbsenceSchema,
} from "./schema";

export class SessionNotFoundError extends Error {
  constructor(readonly sessionId: string) {
    super("Club session not found");
    this.name = "SessionNotFoundError";
  }
}

export class WarningNotFoundError extends Error {
  constructor(readonly warningId: string) {
    super("Warning record not found");
    this.name = "WarningNotFoundError";
  }
}

export class MemberNotActiveError extends Error {
  constructor() {
    super("Active club membership is required to perform this action");
    this.name = "MemberNotActiveError";
  }
}

/**
 * Creates a new club session.
 * Requires 'session:manage' capability.
 */
export async function createClubSession(
  rawInput: CreateSessionInput,
  correlationId: string,
) {
  const actor = await requireCapability("session:manage", correlationId);
  const parsedInput = CreateSessionSchema.parse(rawInput);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [session] = await transaction
        .insert(clubSessions)
        .values({
          title: parsedInput.title,
          sessionDate: parsedInput.sessionDate,
          startTime: parsedInput.startTime,
          endTime: parsedInput.endTime,
          location: parsedInput.location,
          notes: parsedInput.notes,
          createdByIdentityId: actor.identityId,
        })
        .returning();

      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "operator",
        source: "web",
        correlationId,
        category: "session",
        action: "create",
        targetType: "club_session",
        targetId: session.id,
        result: "success",
        metadata: {
          sessionDate: session.sessionDate,
          title: session.title,
        },
      });

      return session;
    }),
  );
}

/**
 * Lists all club sessions with summary counts.
 */
export async function listClubSessions(): Promise<SessionListItem[]> {
  return withDatabase(async (database) => {
    const sessions = await database
      .select({
        id: clubSessions.id,
        title: clubSessions.title,
        sessionDate: clubSessions.sessionDate,
        startTime: clubSessions.startTime,
        endTime: clubSessions.endTime,
        location: clubSessions.location,
        notes: clubSessions.notes,
        createdAt: clubSessions.createdAt,
      })
      .from(clubSessions)
      .orderBy(desc(clubSessions.sessionDate), desc(clubSessions.createdAt));

    if (sessions.length === 0) return [];

    // Get attendance stats per session
    const stats = await database
      .select({
        sessionId: sessionAttendance.sessionId,
        presentCount: sql<number>`count(*) filter (where ${sessionAttendance.status} = 'present')::int`,
        totalMarked: sql<number>`count(*) filter (where ${sessionAttendance.status} != 'unmarked')::int`,
      })
      .from(sessionAttendance)
      .groupBy(sessionAttendance.sessionId);

    const statsMap = new Map(
      stats.map((s) => [
        s.sessionId,
        { presentCount: s.presentCount, totalMarked: s.totalMarked },
      ]),
    );

    return sessions.map((s) => ({
      id: s.id,
      title: s.title,
      sessionDate: s.sessionDate,
      startTime: s.startTime,
      endTime: s.endTime,
      location: s.location,
      notes: s.notes,
      createdAt: s.createdAt.toISOString(),
      presentCount: statsMap.get(s.id)?.presentCount || 0,
      totalMarked: statsMap.get(s.id)?.totalMarked || 0,
    }));
  });
}

/**
 * Gets a single club session by ID.
 */
export async function getClubSessionById(sessionId: string) {
  return withDatabase(async (database) => {
    const [session] = await database
      .select()
      .from(clubSessions)
      .where(eq(clubSessions.id, sessionId))
      .limit(1);

    return session || null;
  });
}

/**
 * Records or updates attendance for a session in a single batch.
 * Requires 'attendance:record' capability.
 */
export async function recordSessionAttendance(
  sessionId: string,
  records: RecordAttendanceItem[],
  correlationId: string,
) {
  const actor = await requireCapability("attendance:record", correlationId);
  const parsed = RecordAttendanceBatchSchema.parse({ sessionId, records });

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [session] = await transaction
        .select({ id: clubSessions.id, sessionDate: clubSessions.sessionDate })
        .from(clubSessions)
        .where(eq(clubSessions.id, parsed.sessionId))
        .limit(1);

      if (!session) {
        throw new SessionNotFoundError(parsed.sessionId);
      }

      for (const item of parsed.records) {
        await transaction
          .insert(sessionAttendance)
          .values({
            sessionId: session.id,
            memberId: item.memberId,
            status: item.status,
            notes: item.notes,
            recordedByIdentityId: actor.identityId,
          })
          .onConflictDoUpdate({
            target: [sessionAttendance.sessionId, sessionAttendance.memberId],
            set: {
              status: item.status,
              notes: item.notes,
              recordedByIdentityId: actor.identityId,
              updatedAt: new Date(),
            },
          });
      }

      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "operator",
        source: "web",
        correlationId,
        category: "attendance",
        action: "record",
        targetType: "club_session",
        targetId: session.id,
        result: "success",
        metadata: {
          sessionDate: session.sessionDate,
          recordsCount: parsed.records.length,
        },
      });

      return { success: true, count: parsed.records.length };
    }),
  );
}

/**
 * Retrieves the complete attendance roster for a session, merging active members,
 * existing attendance ledger entries, and any expected absences for the session date.
 */
export async function getSessionAttendance(
  sessionId: string,
): Promise<{ session: any; roster: MemberSessionAttendance[] }> {
  return withDatabase(async (database) => {
    const [session] = await database
      .select()
      .from(clubSessions)
      .where(eq(clubSessions.id, sessionId))
      .limit(1);

    if (!session) {
      throw new SessionNotFoundError(sessionId);
    }

    // 1. Fetch all active members
    const members = await database
      .select({
        id: clubMembers.id,
        identityId: clubMembers.identityId,
        status: clubMembers.status,
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
      .where(eq(clubMembers.status, "active"))
      .orderBy(studentApplications.preferredName);

    if (members.length === 0) {
      return { session, roster: [] };
    }

    const memberIds = members.map((m) => m.id);

    // 2. Fetch existing attendance records for this session
    const attendanceRecords = await database
      .select({
        memberId: sessionAttendance.memberId,
        status: sessionAttendance.status,
        notes: sessionAttendance.notes,
      })
      .from(sessionAttendance)
      .where(
        and(
          eq(sessionAttendance.sessionId, session.id),
          inArray(sessionAttendance.memberId, memberIds),
        ),
      );

    const attendanceMap = new Map(
      attendanceRecords.map((a) => [a.memberId, a]),
    );

    // 3. Fetch expected absences for this date
    const absences = await database
      .select({
        id: expectedAbsences.id,
        memberId: expectedAbsences.memberId,
        reason: expectedAbsences.reason,
        status: expectedAbsences.status,
      })
      .from(expectedAbsences)
      .where(
        and(
          eq(expectedAbsences.sessionDate, session.sessionDate),
          eq(expectedAbsences.status, "submitted"),
          inArray(expectedAbsences.memberId, memberIds),
        ),
      );

    const absenceMap = new Map(absences.map((ab) => [ab.memberId, ab]));

    const roster: MemberSessionAttendance[] = members.map((m) => {
      const att = attendanceMap.get(m.id);
      const abs = absenceMap.get(m.id);

      return {
        memberId: m.id,
        preferredName: m.preferredName || "Member",
        email: m.email,
        grade: m.grade,
        status: att ? att.status : "unmarked",
        notes: att?.notes || null,
        expectedAbsence: abs
          ? {
              id: abs.id,
              reason: abs.reason,
              status: abs.status,
            }
          : null,
      };
    });

    return { session, roster };
  });
}

/**
 * Submits an expected absence ahead of a club meeting.
 * Can be submitted by the member themselves, or by leadership on member's behalf.
 */
export async function submitExpectedAbsence(
  rawInput: SubmitExpectedAbsenceInput,
  correlationId: string,
) {
  const identity = await resolveCurrentIdentity();
  const parsedInput = SubmitExpectedAbsenceSchema.parse(rawInput);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      let targetMemberId = parsedInput.memberId;

      if (!targetMemberId) {
        // Submitting for oneself: verify active membership
        const [myMember] = await transaction
          .select({ id: clubMembers.id })
          .from(clubMembers)
          .where(
            and(
              eq(clubMembers.identityId, identity.identityId),
              eq(clubMembers.status, "active"),
            ),
          )
          .limit(1);

        if (!myMember) {
          throw new MemberNotActiveError();
        }
        targetMemberId = myMember.id;
      } else {
        // Submitting on behalf of another member: requires leadership capability
        await requireCapability("attendance:record", correlationId);
      }

      const [absence] = await transaction
        .insert(expectedAbsences)
        .values({
          memberId: targetMemberId,
          sessionId: parsedInput.sessionId || null,
          sessionDate: parsedInput.sessionDate,
          reason: parsedInput.reason,
          status: "submitted",
          submittedByIdentityId: identity.identityId,
        })
        .returning();

      await recordBusinessAuditEvent(transaction, {
        actorId: identity.identityId,
        actorType: "user",
        actorRoleSnapshot: identity.accessLevel || "none",
        source: "web",
        correlationId,
        category: "absence",
        action: "submit",
        targetType: "expected_absence",
        targetId: absence.id,
        result: "success",
        metadata: {
          memberId: targetMemberId,
          sessionDate: parsedInput.sessionDate,
        },
      });

      return absence;
    }),
  );
}

/**
 * Derives attendance summary totals for a given member.
 */
export async function getMemberAttendanceTotals(
  memberId: string,
): Promise<AttendanceTotals> {
  return withDatabase(async (database) => {
    // Total sessions up to today
    const [totalSessionsResult] = await database
      .select({ count: sql<number>`count(*)::int` })
      .from(clubSessions);

    const totalSessions = totalSessionsResult?.count || 0;

    const records = await database
      .select({
        status: sessionAttendance.status,
        count: sql<number>`count(*)::int`,
      })
      .from(sessionAttendance)
      .where(eq(sessionAttendance.memberId, memberId))
      .groupBy(sessionAttendance.status);

    const countMap = new Map(records.map((r) => [r.status, r.count]));

    const presentCount = countMap.get("present") || 0;
    const lateCount = countMap.get("late") || 0;
    const excusedCount = countMap.get("excused_absence") || 0;
    const unexcusedCount = countMap.get("unexcused_absence") || 0;
    const unmarkedCount = countMap.get("unmarked") || 0;

    const attendedCount = presentCount + lateCount;
    const totalConsidered = attendedCount + unexcusedCount;
    const attendanceRate =
      totalConsidered > 0
        ? Math.round((attendedCount / totalConsidered) * 100)
        : 100;

    return {
      totalSessions,
      presentCount,
      lateCount,
      excusedCount,
      unexcusedCount,
      unmarkedCount,
      attendanceRate,
    };
  });
}

/**
 * Issues a deliberate manual warning for a member.
 * Requires 'warning:manage' capability.
 */
export async function issueManualWarning(
  rawInput: IssueWarningInput,
  correlationId: string,
) {
  const actor = await requireCapability("warning:manage", correlationId);
  const parsedInput = IssueWarningSchema.parse(rawInput);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [warning] = await transaction
        .insert(memberWarnings)
        .values({
          memberId: parsedInput.memberId,
          issuedByIdentityId: actor.identityId,
          reason: parsedInput.reason,
          notes: parsedInput.notes,
          active: true,
        })
        .returning();

      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "operator",
        source: "web",
        correlationId,
        category: "warning",
        action: "issue",
        targetType: "member_warning",
        targetId: warning.id,
        result: "success",
        metadata: {
          memberId: parsedInput.memberId,
          reason: parsedInput.reason,
        },
      });

      return warning;
    }),
  );
}

/**
 * Lists warnings across members or for a specific member.
 */
export async function listWarnings(
  memberId?: string,
): Promise<WarningListItem[]> {
  return withDatabase(async (database) => {
    let query = database
      .select({
        id: memberWarnings.id,
        memberId: memberWarnings.memberId,
        reason: memberWarnings.reason,
        notes: memberWarnings.notes,
        active: memberWarnings.active,
        issuedAt: memberWarnings.issuedAt,
        resolvedAt: memberWarnings.resolvedAt,
        preferredName: studentApplications.preferredName,
        email: applicationIdentities.email,
      })
      .from(memberWarnings)
      .innerJoin(clubMembers, eq(memberWarnings.memberId, clubMembers.id))
      .innerJoin(
        applicationIdentities,
        eq(clubMembers.identityId, applicationIdentities.id),
      )
      .leftJoin(
        studentApplications,
        eq(clubMembers.applicationId, studentApplications.id),
      )
      .orderBy(desc(memberWarnings.issuedAt));

    if (memberId) {
      query = query.where(eq(memberWarnings.memberId, memberId)) as any;
    }

    const rows = await query;

    return rows.map((r) => ({
      id: r.id,
      memberId: r.memberId,
      memberName: r.preferredName || "Member",
      memberEmail: r.email,
      reason: r.reason,
      notes: r.notes,
      active: r.active,
      issuedAt: r.issuedAt.toISOString(),
      resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
    }));
  });
}

/**
 * Resolves an active warning record.
 * Requires 'warning:manage' capability.
 */
export async function resolveWarning(warningId: string, correlationId: string) {
  const actor = await requireCapability("warning:manage", correlationId);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(memberWarnings)
        .where(eq(memberWarnings.id, warningId))
        .limit(1);

      if (!existing) {
        throw new WarningNotFoundError(warningId);
      }

      const [updated] = await transaction
        .update(memberWarnings)
        .set({
          active: false,
          resolvedAt: new Date(),
          resolvedByIdentityId: actor.identityId,
        })
        .where(eq(memberWarnings.id, warningId))
        .returning();

      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "operator",
        source: "web",
        correlationId,
        category: "warning",
        action: "resolve",
        targetType: "member_warning",
        targetId: warningId,
        result: "success",
      });

      return updated;
    }),
  );
}

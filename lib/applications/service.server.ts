import "server-only";

import { desc, eq } from "drizzle-orm";
import { sql } from "drizzle-orm";

import { applicationIdentities, studentApplications } from "@/db/schema";
import {
  requireCapability,
  resolveCurrentIdentity,
} from "@/lib/auth/identity-access.server";
import { withDatabase } from "@/lib/db/client.server";
import { recordBusinessAuditEvent } from "@/lib/security/audit";
import {
  type ApplicationStatus,
  type ApplicationStatusUpdate,
  type StudentApplicationInput,
  ApplicationStatusUpdateSchema,
  StudentApplicationInputSchema,
} from "./schema";
import { generateApplicationsCsv } from "./csv";

export class DuplicateApplicationError extends Error {
  constructor(readonly applicationId: string) {
    super(
      "An application has already been submitted for this verified identity",
    );
    this.name = "DuplicateApplicationError";
  }
}

export class ApplicationNotFoundError extends Error {
  constructor(readonly applicationId: string) {
    super("Application not found");
    this.name = "ApplicationNotFoundError";
  }
}

export class UnverifiedAffiliationError extends Error {
  constructor() {
    super("Application requires a verified @tokyois.com account affiliation");
    this.name = "UnverifiedAffiliationError";
  }
}

export async function submitStudentApplication(
  rawInput: StudentApplicationInput,
  correlationId: string,
) {
  const identity = await resolveCurrentIdentity();

  if (!identity.active || identity.affiliationStatus !== "verified") {
    throw new UnverifiedAffiliationError();
  }

  const parsedInput = StudentApplicationInputSchema.parse(rawInput);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      // Duplicate prevention check
      const existing = await transaction
        .select({ id: studentApplications.id })
        .from(studentApplications)
        .where(eq(studentApplications.identityId, identity.identityId))
        .limit(1);

      if (existing.length > 0) {
        throw new DuplicateApplicationError(existing[0].id);
      }

      const [application] = await transaction
        .insert(studentApplications)
        .values({
          identityId: identity.identityId,
          preferredName: parsedInput.preferredName,
          grade: parsedInput.grade,
          academicInterests: parsedInput.academicInterests,
          joinReason: parsedInput.joinReason,
          goals: parsedInput.goals,
          experience: parsedInput.experience,
          attendanceConfirmation: parsedInput.attendanceConfirmation,
          accuracyAcknowledged: true,
          status: "submitted",
        })
        .returning({
          id: studentApplications.id,
          status: studentApplications.status,
          submittedAt: studentApplications.submittedAt,
        });

      // Append-only business audit event (using bounded metadata only; zero copied essay text)
      await recordBusinessAuditEvent(transaction, {
        actorId: identity.identityId,
        actorType: "user",
        actorRoleSnapshot: "none",
        source: "web",
        correlationId,
        category: "application",
        action: "submit",
        targetType: "student_application",
        targetId: application.id,
        result: "success",
        metadata: {
          grade: parsedInput.grade,
        },
      });

      return application;
    }),
  );
}

export async function getMySubmittedApplication() {
  try {
    const identity = await resolveCurrentIdentity();
    if (!identity.active || identity.affiliationStatus !== "verified") {
      return null;
    }

    return withDatabase(async (database) => {
      const [app] = await database
        .select({
          id: studentApplications.id,
          preferredName: studentApplications.preferredName,
          grade: studentApplications.grade,
          status: studentApplications.status,
          submittedAt: studentApplications.submittedAt,
        })
        .from(studentApplications)
        .where(eq(studentApplications.identityId, identity.identityId))
        .limit(1);

      return app ?? null;
    });
  } catch {
    return null;
  }
}

export async function listApplicationsForReview(
  correlationId: string,
  filter?: { status?: ApplicationStatus },
) {
  await requireCapability("application:review", correlationId);

  return withDatabase(async (database) => {
    const query = database
      .select({
        id: studentApplications.id,
        identityId: studentApplications.identityId,
        email: applicationIdentities.email,
        preferredName: studentApplications.preferredName,
        grade: studentApplications.grade,
        academicInterests: studentApplications.academicInterests,
        attendanceConfirmation: studentApplications.attendanceConfirmation,
        status: studentApplications.status,
        statusReason: studentApplications.statusReason,
        submittedAt: studentApplications.submittedAt,
        statusUpdatedAt: studentApplications.statusUpdatedAt,
      })
      .from(studentApplications)
      .innerJoin(
        applicationIdentities,
        eq(studentApplications.identityId, applicationIdentities.id),
      )
      .orderBy(desc(studentApplications.submittedAt));

    if (filter?.status) {
      return query.where(eq(studentApplications.status, filter.status));
    }

    return query;
  });
}

export async function getApplicationDetailForReview(
  applicationId: string,
  correlationId: string,
) {
  await requireCapability("application:review", correlationId);

  return withDatabase(async (database) => {
    const [app] = await database
      .select({
        id: studentApplications.id,
        identityId: studentApplications.identityId,
        email: applicationIdentities.email,
        preferredName: studentApplications.preferredName,
        grade: studentApplications.grade,
        academicInterests: studentApplications.academicInterests,
        joinReason: studentApplications.joinReason,
        goals: studentApplications.goals,
        experience: studentApplications.experience,
        attendanceConfirmation: studentApplications.attendanceConfirmation,
        accuracyAcknowledged: studentApplications.accuracyAcknowledged,
        status: studentApplications.status,
        statusReason: studentApplications.statusReason,
        reviewedByIdentityId: studentApplications.reviewedByIdentityId,
        submittedAt: studentApplications.submittedAt,
        statusUpdatedAt: studentApplications.statusUpdatedAt,
      })
      .from(studentApplications)
      .innerJoin(
        applicationIdentities,
        eq(studentApplications.identityId, applicationIdentities.id),
      )
      .where(eq(studentApplications.id, applicationId))
      .limit(1);

    if (!app) {
      throw new ApplicationNotFoundError(applicationId);
    }

    return app;
  });
}

export async function updateApplicationStatus(
  applicationId: string,
  rawUpdate: ApplicationStatusUpdate,
  correlationId: string,
) {
  const reviewer = await requireCapability("application:review", correlationId);
  const parsedUpdate = ApplicationStatusUpdateSchema.parse(rawUpdate);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select({
          id: studentApplications.id,
          status: studentApplications.status,
        })
        .from(studentApplications)
        .where(eq(studentApplications.id, applicationId))
        .limit(1);

      if (!existing) {
        throw new ApplicationNotFoundError(applicationId);
      }

      const [updated] = await transaction
        .update(studentApplications)
        .set({
          status: parsedUpdate.status,
          statusReason: parsedUpdate.statusReason,
          reviewedByIdentityId: reviewer.identityId,
          statusUpdatedAt: sql`clock_timestamp()`,
        })
        .where(eq(studentApplications.id, applicationId))
        .returning();

      await recordBusinessAuditEvent(transaction, {
        actorId: reviewer.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "action",
        correlationId,
        category: "application",
        action: "update_status",
        targetType: "student_application",
        targetId: applicationId,
        result: "success",
        reasonCode: parsedUpdate.status,
        beforeSummary: { status: existing.status },
        afterSummary: { status: parsedUpdate.status },
      });

      return updated;
    }),
  );
}

export async function exportApplicationsCsvData(
  correlationId: string,
): Promise<string> {
  const actor = await requireCapability("application:export", correlationId);

  return withDatabase(async (database) => {
    const rows = await database
      .select({
        id: studentApplications.id,
        email: applicationIdentities.email,
        preferredName: studentApplications.preferredName,
        grade: studentApplications.grade,
        academicInterests: studentApplications.academicInterests,
        joinReason: studentApplications.joinReason,
        goals: studentApplications.goals,
        experience: studentApplications.experience,
        attendanceConfirmation: studentApplications.attendanceConfirmation,
        status: studentApplications.status,
        statusReason: studentApplications.statusReason,
        submittedAt: studentApplications.submittedAt,
      })
      .from(studentApplications)
      .innerJoin(
        applicationIdentities,
        eq(studentApplications.identityId, applicationIdentities.id),
      )
      .orderBy(desc(studentApplications.submittedAt));

    await recordBusinessAuditEvent(database, {
      actorId: actor.identityId,
      actorType: "user",
      actorRoleSnapshot: "leadership",
      source: "action",
      correlationId,
      category: "application",
      action: "export",
      targetType: "student_applications",
      targetId: "all",
      result: "success",
      reasonCode: "csv_export",
    });

    return generateApplicationsCsv(rows);
  });
}

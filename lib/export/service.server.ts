import "server-only";

import { desc, eq } from "drizzle-orm";

import {
  announcements,
  applicationIdentities,
  clubMembers,
  clubResources,
  clubSessions,
  expectedAbsences,
  memberWarnings,
  sessionAttendance,
  studentApplications,
} from "@/db/schema";
import { requireCapability } from "@/lib/auth/identity-access.server";
import { withDatabase } from "@/lib/db/client.server";
import { csvDate, toCsv } from "./csv";
import { type ExportDataset } from "./datasets";

/*
 * Exporting the club's own records.
 *
 * Every dataset the site holds should be removable from it. A club that cannot
 * get its data out is one bad afternoon away from losing years of it, and
 * leadership changes every year.
 *
 * Applications keep their own export route: they are the most sensitive
 * dataset here and are gated on application:export separately, so widening
 * this never widens access to them.
 */

/**
 * Builds a dataset's CSV. Performs no authorization of its own.
 *
 * Kept private so the only ways in are the two exported wrappers below, each
 * of which states plainly what authorized the call.
 */
async function buildDatasetCsv(dataset: ExportDataset): Promise<string> {
  return withDatabase(async (database) => {
    switch (dataset) {
      case "members": {
        const rows = await database
          .select({
            id: clubMembers.id,
            rosterName: clubMembers.rosterName,
            displayName: clubMembers.displayName,
            preferredName: studentApplications.preferredName,
            email: applicationIdentities.email,
            grade: studentApplications.grade,
            status: clubMembers.status,
            joinedAt: clubMembers.joinedAt,
            leftAt: clubMembers.leftAt,
            statusReason: clubMembers.statusReason,
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

        return toCsv(
          [
            "Member ID",
            "Roster Name",
            "Member's Own Name",
            "Application Name",
            "School Email",
            "Grade",
            "Status",
            "Joined At",
            "Left At",
            "Status Reason",
          ],
          rows.map((row) => [
            row.id,
            row.rosterName ?? row.preferredName ?? "",
            row.displayName ?? "",
            row.preferredName ?? "",
            row.email,
            row.grade ?? "",
            row.status,
            csvDate(row.joinedAt),
            csvDate(row.leftAt),
            row.statusReason ?? "",
          ]),
        );
      }

      case "sessions": {
        const rows = await database
          .select()
          .from(clubSessions)
          .orderBy(desc(clubSessions.sessionDate));

        return toCsv(
          [
            "Session ID",
            "Date",
            "Topic",
            "Start",
            "End",
            "Location",
            "Notes",
            "Drive Folder",
          ],
          rows.map((row) => [
            row.id,
            row.sessionDate,
            row.title,
            row.startTime,
            row.endTime,
            row.location,
            row.notes ?? "",
            row.driveFolderId ?? "",
          ]),
        );
      }

      case "attendance": {
        const rows = await database
          .select({
            sessionDate: clubSessions.sessionDate,
            title: clubSessions.title,
            email: applicationIdentities.email,
            rosterName: clubMembers.rosterName,
            preferredName: studentApplications.preferredName,
            status: sessionAttendance.status,
            notes: sessionAttendance.notes,
            recordedAt: sessionAttendance.recordedAt,
          })
          .from(sessionAttendance)
          .innerJoin(
            clubSessions,
            eq(sessionAttendance.sessionId, clubSessions.id),
          )
          .innerJoin(
            clubMembers,
            eq(sessionAttendance.memberId, clubMembers.id),
          )
          .innerJoin(
            applicationIdentities,
            eq(clubMembers.identityId, applicationIdentities.id),
          )
          .leftJoin(
            studentApplications,
            eq(clubMembers.applicationId, studentApplications.id),
          )
          .orderBy(desc(clubSessions.sessionDate));

        return toCsv(
          [
            "Date",
            "Session",
            "Member",
            "School Email",
            "Status",
            "Notes",
            "Recorded At",
          ],
          rows.map((row) => [
            row.sessionDate,
            row.title,
            row.rosterName ?? row.preferredName ?? "",
            row.email,
            row.status,
            row.notes ?? "",
            csvDate(row.recordedAt),
          ]),
        );
      }

      case "absences": {
        const rows = await database
          .select({
            sessionDate: expectedAbsences.sessionDate,
            reason: expectedAbsences.reason,
            status: expectedAbsences.status,
            createdAt: expectedAbsences.createdAt,
            email: applicationIdentities.email,
            rosterName: clubMembers.rosterName,
            preferredName: studentApplications.preferredName,
          })
          .from(expectedAbsences)
          .innerJoin(clubMembers, eq(expectedAbsences.memberId, clubMembers.id))
          .innerJoin(
            applicationIdentities,
            eq(clubMembers.identityId, applicationIdentities.id),
          )
          .leftJoin(
            studentApplications,
            eq(clubMembers.applicationId, studentApplications.id),
          )
          .orderBy(desc(expectedAbsences.sessionDate));

        return toCsv(
          [
            "Session Date",
            "Member",
            "School Email",
            "Status",
            "Reason",
            "Filed At",
          ],
          rows.map((row) => [
            row.sessionDate,
            row.rosterName ?? row.preferredName ?? "",
            row.email,
            row.status,
            row.reason,
            csvDate(row.createdAt),
          ]),
        );
      }

      case "warnings": {
        const rows = await database
          .select({
            id: memberWarnings.id,
            reason: memberWarnings.reason,
            notes: memberWarnings.notes,
            active: memberWarnings.active,
            issuedAt: memberWarnings.issuedAt,
            resolvedAt: memberWarnings.resolvedAt,
            email: applicationIdentities.email,
            rosterName: clubMembers.rosterName,
            preferredName: studentApplications.preferredName,
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

        return toCsv(
          [
            "Warning ID",
            "Member",
            "School Email",
            "Reason",
            "Notes",
            "Active",
            "Issued At",
            "Resolved At",
          ],
          rows.map((row) => [
            row.id,
            row.rosterName ?? row.preferredName ?? "",
            row.email,
            row.reason,
            row.notes ?? "",
            row.active ? "yes" : "no",
            csvDate(row.issuedAt),
            csvDate(row.resolvedAt),
          ]),
        );
      }

      case "announcements": {
        const rows = await database
          .select()
          .from(announcements)
          .orderBy(desc(announcements.createdAt));

        return toCsv(
          [
            "Announcement ID",
            "Title",
            "Body",
            "Published",
            "Published At",
            "Created At",
          ],
          rows.map((row) => [
            row.id,
            row.title,
            row.body,
            row.published ? "yes" : "no",
            csvDate(row.publishedAt),
            csvDate(row.createdAt),
          ]),
        );
      }

      case "resources": {
        const rows = await database
          .select()
          .from(clubResources)
          .orderBy(clubResources.sortOrder);

        return toCsv(
          ["Resource ID", "Name", "Description", "Link", "Order"],
          rows.map((row) => [
            row.id,
            row.title,
            row.description,
            row.url,
            row.sortOrder,
          ]),
        );
      }
    }
  });
}

/** A leadership account downloading an export. */
export async function exportDatasetCsv(
  dataset: ExportDataset,
  correlationId: string,
): Promise<string> {
  await requireCapability("data:export", correlationId);
  return buildDatasetCsv(dataset);
}

/**
 * The scheduled backup, which runs with no signed-in user.
 *
 * There is no capability to check, so the caller is the authorization: this is
 * reachable only from the backup route, after it has verified the cron secret.
 * It is exported separately from exportDatasetCsv precisely so that this
 * unauthenticated path is visible at every call site rather than hidden behind
 * an optional argument.
 */
export async function exportDatasetCsvForScheduledBackup(
  dataset: ExportDataset,
): Promise<string> {
  return buildDatasetCsv(dataset);
}

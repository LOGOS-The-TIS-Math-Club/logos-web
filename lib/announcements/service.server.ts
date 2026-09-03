import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { announcements } from "@/db/schema";
import { requireCapability } from "@/lib/auth/identity-access.server";
import { withDatabase } from "@/lib/db/client.server";
import { recordBusinessAuditEvent } from "@/lib/security/audit";

import {
  AnnouncementInputSchema,
  type AnnouncementInput,
  type AnnouncementRecord,
} from "./schema";

/*
 * Announcements let leadership change the public noticeboard without a code
 * change and a deploy.
 *
 * The public read is deliberately a separate function from the managed read:
 * it takes no capability, selects only the fields the public page renders, and
 * filters to published rows in the query itself rather than in the caller, so
 * an unpublished draft cannot leak through a caller's mistake.
 */

export interface PublicAnnouncement {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly publishedAt: Date;
}

/** Unauthenticated read for the public site. Published rows only. */
export async function listPublishedAnnouncements(
  limit = 5,
): Promise<PublicAnnouncement[]> {
  return withDatabase(async (database) => {
    const rows = await database
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        publishedAt: announcements.publishedAt,
      })
      .from(announcements)
      .where(eq(announcements.published, true))
      .orderBy(desc(announcements.publishedAt))
      .limit(limit);

    // publishedAt is non-null for published rows by database check constraint;
    // the filter keeps TypeScript honest without trusting that at runtime.
    return rows.flatMap((row) =>
      row.publishedAt ? [{ ...row, publishedAt: row.publishedAt as Date }] : [],
    );
  });
}

/** Full list including drafts. Leadership only. */
export async function listAnnouncementsForManagement(
  correlationId: string,
): Promise<AnnouncementRecord[]> {
  await requireCapability("announcement:manage", correlationId);

  return withDatabase(async (database) =>
    database
      .select({
        id: announcements.id,
        title: announcements.title,
        body: announcements.body,
        published: announcements.published,
        publishedAt: announcements.publishedAt,
        updatedAt: announcements.updatedAt,
      })
      .from(announcements)
      .orderBy(desc(announcements.updatedAt)),
  );
}

export async function createAnnouncement(
  input: AnnouncementInput,
  correlationId: string,
): Promise<{ id: string }> {
  const identity = await requireCapability(
    "announcement:manage",
    correlationId,
  );
  const parsed = AnnouncementInputSchema.parse(input);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [created] = await transaction
        .insert(announcements)
        .values({
          title: parsed.title,
          body: parsed.body,
          published: parsed.published,
          publishedAt: parsed.published ? new Date() : null,
          createdByIdentityId: identity.identityId,
        })
        .returning({ id: announcements.id });

      await recordBusinessAuditEvent(transaction, {
        actorId: identity.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "web",
        correlationId,
        category: "announcement",
        action: "create",
        targetType: "announcement",
        targetId: created.id,
        result: "success",
        // Titles and bodies are public content, but the audit journal keeps
        // bounded metadata only; the row itself is the record of what changed.
        metadata: { published: parsed.published },
      });

      return created;
    }),
  );
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput,
  correlationId: string,
): Promise<void> {
  const identity = await requireCapability(
    "announcement:manage",
    correlationId,
  );
  const parsed = AnnouncementInputSchema.parse(input);

  await withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select({
          published: announcements.published,
          publishedAt: announcements.publishedAt,
        })
        .from(announcements)
        .where(eq(announcements.id, id))
        .limit(1);

      if (!existing) throw new Error("Announcement not found");

      // Keep the original publication time when a row stays published, so
      // editing a typo does not jump the notice back to the top of the list.
      const publishedAt = parsed.published
        ? (existing.publishedAt ?? new Date())
        : null;

      await transaction
        .update(announcements)
        .set({
          title: parsed.title,
          body: parsed.body,
          published: parsed.published,
          publishedAt,
          updatedAt: new Date(),
        })
        .where(eq(announcements.id, id));

      await recordBusinessAuditEvent(transaction, {
        actorId: identity.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "web",
        correlationId,
        category: "announcement",
        action: "update",
        targetType: "announcement",
        targetId: id,
        result: "success",
        beforeSummary: { published: existing.published },
        afterSummary: { published: parsed.published },
      });
    }),
  );
}

export async function deleteAnnouncement(
  id: string,
  correlationId: string,
): Promise<void> {
  const identity = await requireCapability(
    "announcement:manage",
    correlationId,
  );

  await withDatabase((database) =>
    database.transaction(async (transaction) => {
      const deleted = await transaction
        .delete(announcements)
        .where(and(eq(announcements.id, id)))
        .returning({ id: announcements.id });

      if (deleted.length === 0) throw new Error("Announcement not found");

      await recordBusinessAuditEvent(transaction, {
        actorId: identity.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "web",
        correlationId,
        category: "announcement",
        action: "delete",
        targetType: "announcement",
        targetId: id,
        result: "success",
      });
    }),
  );
}

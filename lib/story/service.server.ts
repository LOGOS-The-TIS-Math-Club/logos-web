import "server-only";

import { asc, desc, eq } from "drizzle-orm";

import { images, storyEntries } from "@/db/schema";
import { requireCapability } from "@/lib/auth/identity-access.server";
import { withDatabase } from "@/lib/db/client.server";
import { recordBusinessAuditEvent } from "@/lib/security/audit";
import {
  type PublicStoryEntry,
  type StoryEntryInput,
  type StoryEntryListItem,
  type UpdateStoryEntryInput,
  StoryEntryInputSchema,
  UpdateStoryEntrySchema,
} from "./schema";

export class StoryEntryNotFoundError extends Error {
  constructor(readonly entryId: string) {
    super("Story entry not found");
    this.name = "StoryEntryNotFoundError";
  }
}

/**
 * The published story, oldest first — it reads as a history.
 *
 * Capability-free and filtered inside the query rather than after it, so an
 * unpublished draft can never reach the public page by way of a caller that
 * forgot to filter.
 */
export async function listPublishedStoryEntries(): Promise<PublicStoryEntry[]> {
  return withDatabase(async (database) => {
    const rows = await database
      .select({
        id: storyEntries.id,
        title: storyEntries.title,
        body: storyEntries.body,
        occurredOn: storyEntries.occurredOn,
        imageId: storyEntries.imageId,
        imageAlt: images.altText,
        imageWidth: images.width,
        imageHeight: images.height,
      })
      .from(storyEntries)
      .leftJoin(images, eq(storyEntries.imageId, images.id))
      .where(eq(storyEntries.published, true))
      .orderBy(asc(storyEntries.occurredOn));

    return rows;
  });
}

/** Everything, drafts included. Requires 'content:manage'. */
export async function listStoryEntries(
  correlationId: string,
): Promise<StoryEntryListItem[]> {
  await requireCapability("content:manage", correlationId);

  return withDatabase(async (database) => {
    const rows = await database
      .select({
        id: storyEntries.id,
        title: storyEntries.title,
        body: storyEntries.body,
        occurredOn: storyEntries.occurredOn,
        imageId: storyEntries.imageId,
        imageAlt: images.altText,
        imageWidth: images.width,
        imageHeight: images.height,
        published: storyEntries.published,
        updatedAt: storyEntries.updatedAt,
      })
      .from(storyEntries)
      .leftJoin(images, eq(storyEntries.imageId, images.id))
      .orderBy(desc(storyEntries.occurredOn));

    return rows.map((row) => ({
      ...row,
      updatedAt: row.updatedAt.toISOString(),
    }));
  });
}

export async function createStoryEntry(
  rawInput: StoryEntryInput,
  correlationId: string,
) {
  const actor = await requireCapability("content:manage", correlationId);
  const parsedInput = StoryEntryInputSchema.parse(rawInput);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [entry] = await transaction
        .insert(storyEntries)
        .values({
          title: parsedInput.title,
          body: parsedInput.body,
          occurredOn: parsedInput.occurredOn,
          imageId: parsedInput.imageId ?? null,
          published: parsedInput.published,
          createdByIdentityId: actor.identityId,
        })
        .returning();

      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "web",
        correlationId,
        category: "content",
        action: "create_story_entry",
        targetType: "story_entry",
        targetId: entry.id,
        result: "success",
        afterSummary: { title: entry.title, published: entry.published },
      });

      return entry;
    }),
  );
}

export async function updateStoryEntry(
  entryId: string,
  rawInput: UpdateStoryEntryInput,
  correlationId: string,
) {
  const actor = await requireCapability("content:manage", correlationId);
  const parsedInput = UpdateStoryEntrySchema.parse(rawInput);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(storyEntries)
        .where(eq(storyEntries.id, entryId))
        .limit(1);

      if (!existing) throw new StoryEntryNotFoundError(entryId);

      const [updated] = await transaction
        .update(storyEntries)
        .set({ ...parsedInput, updatedAt: new Date() })
        .where(eq(storyEntries.id, entryId))
        .returning();

      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "web",
        correlationId,
        category: "content",
        action: "update_story_entry",
        targetType: "story_entry",
        targetId: entryId,
        result: "success",
        beforeSummary: {
          title: existing.title,
          published: existing.published,
        },
        afterSummary: { title: updated.title, published: updated.published },
      });

      return updated;
    }),
  );
}

export async function deleteStoryEntry(entryId: string, correlationId: string) {
  const actor = await requireCapability("content:manage", correlationId);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(storyEntries)
        .where(eq(storyEntries.id, entryId))
        .limit(1);

      if (!existing) throw new StoryEntryNotFoundError(entryId);

      await transaction
        .delete(storyEntries)
        .where(eq(storyEntries.id, entryId));

      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "web",
        correlationId,
        category: "content",
        action: "delete_story_entry",
        targetType: "story_entry",
        targetId: entryId,
        result: "success",
        // The row is gone; the journal is the only remaining record of it.
        beforeSummary: {
          title: existing.title,
          occurredOn: existing.occurredOn,
        },
      });

      return { id: entryId };
    }),
  );
}

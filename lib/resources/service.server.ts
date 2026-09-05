import "server-only";

import { asc, eq } from "drizzle-orm";

import { clubResources } from "@/db/schema";
import { requireCapability } from "@/lib/auth/identity-access.server";
import { withDatabase } from "@/lib/db/client.server";
import { recordBusinessAuditEvent } from "@/lib/security/audit";
import {
  type ResourceInput,
  type ResourceItem,
  type UpdateResourceInput,
  ResourceInputSchema,
  UpdateResourceSchema,
} from "./schema";

export class ResourceNotFoundError extends Error {
  constructor(readonly resourceId: string) {
    super("Resource not found");
    this.name = "ResourceNotFoundError";
  }
}

/**
 * The resource cards, in display order.
 *
 * Capability-free: every active member sees these on their dashboard, and the
 * page itself is already behind an active-membership check. Returns only what
 * the cards render.
 */
export async function listResources(): Promise<ResourceItem[]> {
  return withDatabase(async (database) =>
    database
      .select({
        id: clubResources.id,
        title: clubResources.title,
        description: clubResources.description,
        url: clubResources.url,
        sortOrder: clubResources.sortOrder,
      })
      .from(clubResources)
      .orderBy(asc(clubResources.sortOrder), asc(clubResources.title)),
  );
}

export async function createResource(
  rawInput: ResourceInput,
  correlationId: string,
) {
  const actor = await requireCapability("resource:manage", correlationId);
  const parsedInput = ResourceInputSchema.parse(rawInput);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [resource] = await transaction
        .insert(clubResources)
        .values({ ...parsedInput, createdByIdentityId: actor.identityId })
        .returning();

      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "web",
        correlationId,
        category: "resource",
        action: "create",
        targetType: "club_resource",
        targetId: resource.id,
        result: "success",
        afterSummary: { title: resource.title, url: resource.url },
      });

      return resource;
    }),
  );
}

export async function updateResource(
  resourceId: string,
  rawInput: UpdateResourceInput,
  correlationId: string,
) {
  const actor = await requireCapability("resource:manage", correlationId);
  const parsedInput = UpdateResourceSchema.parse(rawInput);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(clubResources)
        .where(eq(clubResources.id, resourceId))
        .limit(1);

      if (!existing) throw new ResourceNotFoundError(resourceId);

      const [updated] = await transaction
        .update(clubResources)
        .set({ ...parsedInput, updatedAt: new Date() })
        .where(eq(clubResources.id, resourceId))
        .returning();

      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "web",
        correlationId,
        category: "resource",
        action: "update",
        targetType: "club_resource",
        targetId: resourceId,
        result: "success",
        beforeSummary: { title: existing.title, url: existing.url },
        afterSummary: { title: updated.title, url: updated.url },
      });

      return updated;
    }),
  );
}

export async function deleteResource(
  resourceId: string,
  correlationId: string,
) {
  const actor = await requireCapability("resource:manage", correlationId);

  return withDatabase((database) =>
    database.transaction(async (transaction) => {
      const [existing] = await transaction
        .select()
        .from(clubResources)
        .where(eq(clubResources.id, resourceId))
        .limit(1);

      if (!existing) throw new ResourceNotFoundError(resourceId);

      await transaction
        .delete(clubResources)
        .where(eq(clubResources.id, resourceId));

      await recordBusinessAuditEvent(transaction, {
        actorId: actor.identityId,
        actorType: "user",
        actorRoleSnapshot: "leadership",
        source: "web",
        correlationId,
        category: "resource",
        action: "delete",
        targetType: "club_resource",
        targetId: resourceId,
        result: "success",
        // The row is gone; the journal is the only remaining record of it.
        beforeSummary: { title: existing.title, url: existing.url },
      });

      return { id: resourceId };
    }),
  );
}

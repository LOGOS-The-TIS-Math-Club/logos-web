import { sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import "server-only";
import { z } from "zod";

import { infrastructureProbe } from "@/db/schema";
import { withDatabase } from "@/lib/db/client.server";
import { ACTOR_ROLES, ACTOR_TYPES, recordBusinessAuditEvent } from "./audit";
import { enqueueDurableOperation } from "./durable-operations";

/**
 * Zod validation schema for synthetic technical mutation input.
 */
export const SyntheticMutationInputSchema = z.object({
  marker: z.string().min(1).max(128),
  previousMarker: z.string().max(128).optional(),
  actorId: z.string().uuid().optional().nullable(),
  actorType: z.enum(ACTOR_TYPES).default("system"),
  actorRoleSnapshot: z.enum(ACTOR_ROLES).default("none"),
  correlationId: z.string().uuid(),
  idempotencyKey: z.string().min(1).max(128),
  reason: z.string().max(64).optional(),
});

export type SyntheticMutationInput = z.input<
  typeof SyntheticMutationInputSchema
>;

export interface SyntheticMutationResult {
  readonly success: boolean;
  readonly correlationId: string;
  readonly auditEventId: string;
  readonly operationId: string;
}

/**
 * Executes an internal server-only composite mutation in a single Drizzle PostgreSQL transaction.
 *
 * Invariants (docs/phase-03.md Section 12):
 * 1. Mutates technical infrastructure data (infrastructure_probe).
 * 2. Appends business audit journal record referencing correlation ID and target.
 * 3. Enqueues durable operation intent referencing originating audit record and correlation ID.
 * 4. All 3 operations commit atomically in ONE transaction, or roll back cleanly on any failure.
 * 5. Unique constraint on (type, idempotency_key) guarantees duplicate prevention.
 * 6. Strictly server-only; never mapped to public HTTP routes.
 *
 * @param input - Synthetic mutation parameters.
 * @param injectedDb - Optional database instance override for testing/transactions.
 */
export async function executeSyntheticTechnicalMutation(
  input: SyntheticMutationInput,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  injectedDb?: PgDatabase<any, any, any>,
): Promise<SyntheticMutationResult> {
  const validated = SyntheticMutationInputSchema.parse(input);

  const runner = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: PgDatabase<any, any, any>,
  ): Promise<SyntheticMutationResult> => {
    return await db.transaction(async (tx) => {
      // 1. Mutate technical data (infrastructure_probe singleton id = 1)
      await tx
        .insert(infrastructureProbe)
        .values({
          id: 1,
          marker: validated.marker,
          updatedAt: sql`clock_timestamp()`,
        })
        .onConflictDoUpdate({
          target: infrastructureProbe.id,
          set: {
            marker: validated.marker,
            updatedAt: sql`clock_timestamp()`,
          },
        });

      // 2. Append business audit event
      const auditEvent = await recordBusinessAuditEvent(tx, {
        actorId: validated.actorId ?? null,
        actorType: validated.actorType,
        actorRoleSnapshot: validated.actorRoleSnapshot,
        source: "internal",
        correlationId: validated.correlationId,
        category: "technical_infrastructure",
        action: "synthetic_probe.update",
        targetType: "infrastructure_probe",
        targetId: "1",
        result: "success",
        beforeSummary: { marker: validated.previousMarker ?? "initial" },
        afterSummary: { marker: validated.marker },
        metadata: { reason: validated.reason ?? "synthetic_mutation" },
      });

      // 3. Record durable operation intent (foreign keyed to business audit record)
      const operation = await enqueueDurableOperation(tx, {
        correlationId: validated.correlationId,
        auditEventId: auditEvent.id,
        type: "synthetic_operation",
        idempotencyKey: validated.idempotencyKey,
        payload: {
          marker: validated.marker,
          correlationId: validated.correlationId,
        },
        maxAttempts: 3,
      });

      return {
        success: true,
        correlationId: validated.correlationId,
        auditEventId: auditEvent.id,
        operationId: operation.id,
      };
    });
  };

  if (injectedDb) {
    return await runner(injectedDb);
  }

  return await withDatabase(runner);
}

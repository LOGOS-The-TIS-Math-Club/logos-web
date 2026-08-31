import { sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import "server-only";
import { z } from "zod";

import { durableOperations } from "@/db/schema";
import { sanitizeAllowedObject } from "./redaction";

export const OPERATION_STATUSES = [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "ambiguous",
] as const;
export type OperationStatus = (typeof OPERATION_STATUSES)[number];

export const OPERATION_PAYLOAD_ALLOWLIST = Object.freeze([
  "marker",
  "correlationId",
  "operationType",
  "targetId",
  "action",
  "reason",
  "policy",
  "schemaVersion",
]);

/**
 * Zod schema for inserting a new durable operation.
 */
export const EnqueueDurableOperationSchema = z.object({
  correlationId: z.string().uuid(),
  auditEventId: z.string().uuid(),
  type: z.string().min(1).max(64),
  idempotencyKey: z.string().min(1).max(128),
  payload: z.record(z.string(), z.unknown()),
  maxAttempts: z.number().int().min(1).max(10).default(5),
  availableAt: z.date().optional(),
});

export type EnqueueDurableOperationInput = z.infer<
  typeof EnqueueDurableOperationSchema
>;

/**
 * Enqueues a durable operation within the current transaction.
 *
 * Invariant: Atomic insert within the primary business transaction.
 * Unique constraint on (type, idempotency_key) guarantees idempotency.
 *
 * @param db - Drizzle database or transaction client.
 * @param input - Durable operation parameters.
 */
export async function enqueueDurableOperation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: PgDatabase<any, any, any>,
  input: EnqueueDurableOperationInput,
) {
  const validated = EnqueueDurableOperationSchema.parse(input);

  const cleanPayload = sanitizeAllowedObject(
    validated.payload,
    OPERATION_PAYLOAD_ALLOWLIST,
    { maxSerializedBytes: 16384 },
  );

  const [operation] = await db
    .insert(durableOperations)
    .values({
      correlationId: validated.correlationId,
      auditEventId: validated.auditEventId,
      type: validated.type,
      idempotencyKey: validated.idempotencyKey,
      status: "pending",
      payload: cleanPayload,
      maxAttempts: validated.maxAttempts,
      availableAt: validated.availableAt ?? sql`clock_timestamp()`,
    })
    .returning();

  return operation;
}

export const ClaimDurableOperationsSchema = z.object({
  workerId: z.string().max(256).nullable().optional(),
  leaseSeconds: z.number().int().min(1).max(3600).default(60),
  limit: z.number().int().min(1).max(100).default(1),
});

export type ClaimDurableOperationsInput = z.input<
  typeof ClaimDurableOperationsSchema
>;

export interface ClaimDurableOperationsOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly db: PgDatabase<any, any, any>;
  readonly workerId?: string | null;
  readonly leaseSeconds?: number;
  readonly limit?: number;
}

export interface ClaimedDurableOperation {
  readonly id: string;
  readonly correlationId: string;
  readonly auditEventId: string;
  readonly type: string;
  readonly idempotencyKey: string;
  readonly status: OperationStatus;
  readonly payload: Record<string, unknown>;
  readonly attemptCount: number;
  readonly maxAttempts: number;
  readonly leaseToken: string;
  readonly leaseExpiresAt: string | Date;
  readonly createdAt: string | Date;
}

interface ClaimDbRow extends Record<string, unknown> {
  id: string;
  correlation_id: string;
  audit_event_id: string;
  type: string;
  idempotency_key: string;
  status: OperationStatus;
  payload: Record<string, unknown>;
  attempt_count: number;
  max_attempts: number;
  lease_token: string;
  lease_expires_at: string | Date;
  created_at: string | Date;
}

/**
 * Concurrency-safe worker claim for durable operations using PostgreSQL SECURITY DEFINER function
 * and FOR UPDATE SKIP LOCKED.
 *
 * @param options - Claim parameters.
 */
export async function claimDurableOperations(
  options: ClaimDurableOperationsOptions,
): Promise<readonly ClaimedDurableOperation[]> {
  const { db, ...claimInput } = options;
  const validated = ClaimDurableOperationsSchema.parse(claimInput);

  const leaseDurationInterval = `${validated.leaseSeconds} seconds`;
  const boundedLimit = validated.limit;
  const workerIdParam = validated.workerId ?? null;

  const queryResult = await db.execute<ClaimDbRow>(sql`
    SELECT
      id,
      correlation_id,
      audit_event_id,
      type,
      idempotency_key,
      status,
      payload,
      attempt_count,
      max_attempts,
      lease_token,
      lease_expires_at,
      created_at
    FROM logos.claim_durable_operation(
      ${workerIdParam}::text,
      ${leaseDurationInterval}::interval,
      ${boundedLimit}::integer
    );
  `);

  const rows = (queryResult.rows ?? []) as readonly ClaimDbRow[];

  return rows.map((row: ClaimDbRow) => ({
    id: row.id,
    correlationId: row.correlation_id,
    auditEventId: row.audit_event_id,
    type: row.type,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    payload: row.payload,
    attemptCount: Number(row.attempt_count),
    maxAttempts: Number(row.max_attempts),
    leaseToken: row.lease_token,
    leaseExpiresAt: row.lease_expires_at,
    createdAt: row.created_at,
  }));
}

export const CompleteDurableOperationSchema = z.object({
  id: z.string().uuid(),
  leaseToken: z.string().min(1).max(128),
  status: z.enum(["succeeded", "failed", "ambiguous"]),
  providerReference: z.string().max(256).nullable().optional(),
  failureCode: z.string().max(64).nullable().optional(),
  lastError: z.string().max(1024).nullable().optional(),
});

export type CompleteDurableOperationInput = z.input<
  typeof CompleteDurableOperationSchema
>;

export interface CompleteDurableOperationOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly db: PgDatabase<any, any, any>;
  readonly id: string;
  readonly leaseToken: string;
  readonly status: "succeeded" | "failed" | "ambiguous";
  readonly providerReference?: string | null;
  readonly failureCode?: string | null;
  readonly lastError?: string | null;
}

/**
 * Fenced completion of a durable operation.
 * Prevents stale worker writes from overwriting subsequent claims.
 * Requires a live, unexpired lease at transition time.
 *
 * @param options - Completion parameters.
 */
export async function completeDurableOperation(
  options: CompleteDurableOperationOptions,
): Promise<boolean> {
  const { db, ...completeInput } = options;
  const validated = CompleteDurableOperationSchema.parse(completeInput);

  const queryResult = await db.execute<{ result: boolean }>(sql`
    SELECT logos.complete_durable_operation(
      ${validated.id}::uuid,
      ${validated.leaseToken}::text,
      ${validated.status}::logos.operation_status,
      ${validated.providerReference ?? null}::text,
      ${validated.failureCode ?? null}::text,
      ${validated.lastError ?? null}::text
    ) AS result;
  `);

  return Boolean(queryResult.rows[0]?.result);
}

export const FailDurableOperationSchema = z.object({
  id: z.string().uuid(),
  leaseToken: z.string().min(1).max(128),
  failureCode: z.string().max(64).nullable().optional(),
  lastError: z.string().max(1024).nullable().optional(),
  retryDelaySeconds: z.number().int().min(1).max(604800).default(30),
});

export type FailDurableOperationInput = z.input<
  typeof FailDurableOperationSchema
>;

export interface FailDurableOperationOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly db: PgDatabase<any, any, any>;
  readonly id: string;
  readonly leaseToken: string;
  readonly failureCode?: string | null;
  readonly lastError?: string | null;
  readonly retryDelaySeconds?: number;
}

/**
 * Fenced retry/failure handling for a durable operation.
 * Resets status to pending with backoff if attempts remain, or marks failed if attempts are exhausted.
 * Requires a live, unexpired lease at transition time.
 *
 * @param options - Failure options.
 */
export async function failDurableOperation(
  options: FailDurableOperationOptions,
): Promise<boolean> {
  const { db, ...failInput } = options;
  const validated = FailDurableOperationSchema.parse(failInput);

  const retryDelayInterval = `${validated.retryDelaySeconds} seconds`;

  const queryResult = await db.execute<{ result: boolean }>(sql`
    SELECT logos.fail_durable_operation(
      ${validated.id}::uuid,
      ${validated.leaseToken}::text,
      ${validated.failureCode ?? null}::text,
      ${validated.lastError ?? null}::text,
      ${retryDelayInterval}::interval
    ) AS result;
  `);

  return Boolean(queryResult.rows[0]?.result);
}

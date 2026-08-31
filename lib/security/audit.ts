import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import "server-only";
import { z } from "zod";

import { businessAuditJournal, securityAuditJournal } from "@/db/schema";
import { sanitizeAllowedObject } from "./redaction";

export const ACTOR_TYPES = [
  "system",
  "user",
  "anonymous",
  "scheduled",
] as const;
export type ActorType = (typeof ACTOR_TYPES)[number];

export const ACTOR_ROLES = [
  "none",
  "applicant",
  "member",
  "leadership",
] as const;
export type ActorRoleSnapshot = (typeof ACTOR_ROLES)[number];

export const AUDIT_SOURCES = ["web", "action", "internal", "cron"] as const;
export type AuditSource = (typeof AUDIT_SOURCES)[number];

export const BUSINESS_AUDIT_RESULTS = ["success", "failed", "denied"] as const;
export type BusinessAuditResult = (typeof BUSINESS_AUDIT_RESULTS)[number];

export const SECURITY_AUDIT_RESULTS = [
  "success",
  "failed",
  "denied",
  "rate_limited",
] as const;
export type SecurityAuditResult = (typeof SECURITY_AUDIT_RESULTS)[number];

/**
 * Zod schema for business audit journal insertion input.
 */
export const BusinessAuditEventSchema = z.object({
  id: z.string().uuid().optional(),
  actorId: z.string().uuid().optional().nullable(),
  actorType: z.enum(ACTOR_TYPES),
  actorRoleSnapshot: z.enum(ACTOR_ROLES),
  source: z.enum(AUDIT_SOURCES),
  correlationId: z.string().uuid(),
  category: z.string().min(1).max(64),
  action: z.string().min(1).max(64),
  targetType: z.string().min(1).max(64),
  targetId: z.string().min(1).max(128),
  result: z.enum(BUSINESS_AUDIT_RESULTS),
  reasonCode: z.string().max(64).optional().nullable(),
  beforeSummary: z.record(z.string(), z.unknown()).optional().nullable(),
  afterSummary: z.record(z.string(), z.unknown()).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type BusinessAuditEventInput = z.infer<typeof BusinessAuditEventSchema>;

/**
 * Zod schema for security audit journal insertion input.
 */
export const SecurityAuditEventSchema = z.object({
  id: z.string().uuid().optional(),
  actorId: z.string().uuid().optional().nullable(),
  actorType: z.enum(ACTOR_TYPES),
  actorRoleSnapshot: z.enum(ACTOR_ROLES),
  source: z.enum(AUDIT_SOURCES),
  correlationId: z.string().uuid(),
  category: z.string().min(1).max(64),
  action: z.string().min(1).max(64),
  targetType: z.string().min(1).max(64),
  targetId: z.string().min(1).max(128),
  result: z.enum(SECURITY_AUDIT_RESULTS),
  reasonCode: z.string().max(64).optional().nullable(),
  metadata: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type SecurityAuditEventInput = z.infer<typeof SecurityAuditEventSchema>;

/**
 * Allowlists of permissible property keys in audit summary and metadata payloads.
 * Excludes sensitive fields (e.g. passwords, secrets, OAuth tokens, session cookies, raw IPs, PII).
 */
export const AUDIT_SUMMARY_ALLOWLIST = Object.freeze([
  "marker",
  "status",
  "count",
  "idempotencyKey",
  "targetType",
  "targetId",
  "reason",
  "policy",
  "schemaVersion",
]);

export const AUDIT_METADATA_ALLOWLIST = Object.freeze([
  "reason",
  "operationType",
  "policy",
  "retryCount",
  "durationMs",
  "failureCode",
  "correlationId",
]);

/**
 * Validates and sanitizes a summary or metadata JSON object before database insertion.
 */
function sanitizeAuditPayload(
  payload: Record<string, unknown> | null | undefined,
  allowedKeys: readonly string[],
): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const sanitized = sanitizeAllowedObject(payload, allowedKeys, {
    maxSerializedBytes: 4096,
  });
  return Object.keys(sanitized).length > 0 ? sanitized : null;
}

/**
 * Records a business audit event in logos.business_audit_journal.
 * Works under INSERT-only runtime role privileges without requiring table SELECT.
 *
 * @param db - Drizzle database or transaction client.
 * @param input - Business audit event parameters.
 */
export async function recordBusinessAuditEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: PgDatabase<any, any, any>,
  input: BusinessAuditEventInput,
) {
  const validated = BusinessAuditEventSchema.parse(input);
  const id = validated.id ?? randomUUID();

  const cleanBefore = sanitizeAuditPayload(
    validated.beforeSummary,
    AUDIT_SUMMARY_ALLOWLIST,
  );
  const cleanAfter = sanitizeAuditPayload(
    validated.afterSummary,
    AUDIT_SUMMARY_ALLOWLIST,
  );
  const cleanMeta = sanitizeAuditPayload(
    validated.metadata,
    AUDIT_METADATA_ALLOWLIST,
  );

  await db.insert(businessAuditJournal).values({
    id,
    actorId: validated.actorId ?? null,
    actorType: validated.actorType,
    actorRoleSnapshot: validated.actorRoleSnapshot,
    source: validated.source,
    correlationId: validated.correlationId,
    category: validated.category,
    action: validated.action,
    targetType: validated.targetType,
    targetId: validated.targetId,
    result: validated.result,
    reasonCode: validated.reasonCode ?? null,
    beforeSummary: cleanBefore,
    afterSummary: cleanAfter,
    metadata: cleanMeta,
  });

  return {
    id,
    ...validated,
    beforeSummary: cleanBefore,
    afterSummary: cleanAfter,
    metadata: cleanMeta,
  };
}

/**
 * Records a security audit event in logos.security_audit_journal.
 * Works under INSERT-only runtime role privileges without requiring table SELECT.
 *
 * @param db - Drizzle database or transaction client.
 * @param input - Security audit event parameters.
 */
export async function recordSecurityAuditEvent(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: PgDatabase<any, any, any>,
  input: SecurityAuditEventInput,
) {
  const validated = SecurityAuditEventSchema.parse(input);
  const id = validated.id ?? randomUUID();

  const cleanMeta = sanitizeAuditPayload(
    validated.metadata,
    AUDIT_METADATA_ALLOWLIST,
  );

  await db.insert(securityAuditJournal).values({
    id,
    actorId: validated.actorId ?? null,
    actorType: validated.actorType,
    actorRoleSnapshot: validated.actorRoleSnapshot,
    source: validated.source,
    correlationId: validated.correlationId,
    category: validated.category,
    action: validated.action,
    targetType: validated.targetType,
    targetId: validated.targetId,
    result: validated.result,
    reasonCode: validated.reasonCode ?? null,
    metadata: cleanMeta,
  });

  return {
    id,
    ...validated,
    metadata: cleanMeta,
  };
}

/**
 * Zod schema for search audit journal options.
 */
export const SearchAuditJournalSchema = z
  .object({
    journalType: z.enum(["business", "security"]),
    limit: z
      .number()
      .int()
      .optional()
      .transform((val) => Math.max(1, Math.min(val ?? 25, 100))),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD")
      .optional(),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format must be YYYY-MM-DD")
      .optional(),
    correlationId: z.string().uuid().optional(),
    actorId: z.string().uuid().optional(),
    targetType: z.string().min(1).max(64).optional(),
    targetId: z.string().min(1).max(128).optional(),
  })
  .refine(
    (data) =>
      Boolean(
        data.startDate ||
        data.endDate ||
        data.correlationId ||
        data.actorId ||
        data.targetType ||
        data.targetId,
      ),
    {
      message:
        "Bounded search requires at least one narrowing filter (date range, correlation ID, actor ID, or target).",
    },
  )
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.startDate <= data.endDate;
      }
      return true;
    },
    {
      message: "Start date cannot be after end date",
    },
  );

export type SearchAuditJournalInput = z.input<typeof SearchAuditJournalSchema>;

/**
 * Search options for the bounded audit query interface.
 */
export interface SearchAuditJournalOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly db: PgDatabase<any, any, any>;
  readonly journalType: "business" | "security";
  readonly limit?: number;
  readonly startDate?: string; // YYYY-MM-DD (Tokyo archive date)
  readonly endDate?: string; // YYYY-MM-DD (Tokyo archive date)
  readonly correlationId?: string;
  readonly actorId?: string;
  readonly targetType?: string;
  readonly targetId?: string;
}

export interface AuditSearchResultRow {
  readonly id: string;
  readonly recordedAt: string | Date;
  readonly tokyoArchiveDate: string;
  readonly schemaVersion: number;
  readonly actorId: string | null;
  readonly actorType: string;
  readonly actorRoleSnapshot: string;
  readonly source: string;
  readonly correlationId: string;
  readonly category: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly result: string;
  readonly reasonCode: string | null;
  readonly beforeSummary: Record<string, unknown> | null;
  readonly afterSummary: Record<string, unknown> | null;
  readonly metadata: Record<string, unknown> | null;
}

interface AuditSearchDbRow extends Record<string, unknown> {
  id: string;
  recorded_at: string | Date;
  tokyo_archive_date: string;
  schema_version: number;
  actor_id: string | null;
  actor_type: string;
  actor_role_snapshot: string;
  source: string;
  correlation_id: string;
  category: string;
  action: string;
  target_type: string;
  target_id: string;
  result: string;
  reason_code: string | null;
  before_summary: Record<string, unknown> | null;
  after_summary: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Bounded hardened query interface for authorized audit log search.
 * Backed by logos.search_audit_journal SECURITY DEFINER PostgreSQL function.
 *
 * Enforces:
 * - Direct table SELECT is denied to runtime role; authorized search uses hardened function.
 * - Mandatory limit: 1 to 100 (default 25).
 * - Mandatory boundary: requires at least one filter (startDate, endDate, correlationId, actorId, targetType, targetId).
 * - Fixed search_path = pg_catalog, logos, pg_temp.
 */
export async function searchAuditJournal(
  options: SearchAuditJournalOptions,
): Promise<readonly AuditSearchResultRow[]> {
  const { db, ...searchInput } = options;
  const validated = SearchAuditJournalSchema.parse(searchInput);

  const queryResult = await db.execute<AuditSearchDbRow>(sql`
    SELECT * FROM logos.search_audit_journal(
      ${validated.journalType}::text,
      ${validated.limit}::integer,
      ${validated.startDate ?? null}::date,
      ${validated.endDate ?? null}::date,
      ${validated.correlationId ?? null}::uuid,
      ${validated.actorId ?? null}::uuid,
      ${validated.targetType ?? null}::text,
      ${validated.targetId ?? null}::text
    );
  `);

  const rows = (queryResult.rows ?? []) as readonly AuditSearchDbRow[];

  return rows.map((row: AuditSearchDbRow) => ({
    id: row.id,
    recordedAt: row.recorded_at,
    tokyoArchiveDate: String(row.tokyo_archive_date),
    schemaVersion: Number(row.schema_version),
    actorId: row.actor_id,
    actorType: row.actor_type,
    actorRoleSnapshot: row.actor_role_snapshot,
    source: row.source,
    correlationId: row.correlation_id,
    category: row.category,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    result: row.result,
    reasonCode: row.reason_code,
    beforeSummary: row.before_summary,
    afterSummary: row.after_summary,
    metadata: row.metadata,
  }));
}

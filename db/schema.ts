import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const logosSchema = pgSchema("logos");

/**
 * A non-domain singleton used only to prove migrations, grants, fixtures, and
 * export/restore before Phase 02 has any domain tables.
 */
export const infrastructureProbe = logosSchema.table("infrastructure_probe", {
  id: integer().primaryKey(),
  marker: text().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * Rate limit tracking table keyed by subject hash, policy, and window start.
 */
export const rateLimits = logosSchema.table(
  "rate_limits",
  {
    subjectHash: text("subject_hash").notNull(),
    policy: text("policy").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    count: integer("count").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    primaryKey({
      name: "rate_limits_pk",
      columns: [t.subjectHash, t.policy, t.windowStart],
    }),
    index("rate_limits_window_idx").on(t.windowStart),
    check(
      "rate_limits_policy_check",
      sql`char_length("policy") > 0 AND char_length("policy") <= 64`,
    ),
    check(
      "rate_limits_subject_hash_check",
      sql`"subject_hash" ~ '^[0-9a-f]{64}$'`,
    ),
    check("rate_limits_count_check", sql`"count" > 0`),
  ],
);

/**
 * Immutable append-only journal for business-meaningful actions and audit records.
 */
export const businessAuditJournal = logosSchema.table(
  "business_audit_journal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    tokyoArchiveDate: date("tokyo_archive_date").generatedAlwaysAs(
      sql`(timezone('Asia/Tokyo', "recorded_at"))::date`,
    ),
    schemaVersion: integer("schema_version").notNull().default(1),
    actorId: uuid("actor_id"),
    actorType: text("actor_type").notNull(),
    actorRoleSnapshot: text("actor_role_snapshot").notNull(),
    source: text("source").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    category: text("category").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    result: text("result").notNull(),
    reasonCode: text("reason_code"),
    beforeSummary: jsonb("before_summary"),
    afterSummary: jsonb("after_summary"),
    metadata: jsonb("metadata"),
  },
  (t) => [
    index("business_audit_tokyo_date_idx").on(t.tokyoArchiveDate, t.recordedAt),
    index("business_audit_correlation_idx").on(t.correlationId),
    index("business_audit_target_idx").on(t.targetType, t.targetId),
    check(
      "business_audit_actor_type_check",
      sql`"actor_type" IN ('system', 'user', 'anonymous', 'scheduled')`,
    ),
    check(
      "business_audit_result_check",
      sql`"result" IN ('success', 'failed', 'denied')`,
    ),
    check(
      "business_audit_category_len_check",
      sql`char_length("category") <= 64`,
    ),
    check("business_audit_action_len_check", sql`char_length("action") <= 64`),
    check(
      "business_audit_target_type_len_check",
      sql`char_length("target_type") <= 64`,
    ),
    check(
      "business_audit_target_id_len_check",
      sql`char_length("target_id") <= 128`,
    ),
    check(
      "business_audit_reason_code_len_check",
      sql`"reason_code" IS NULL OR char_length("reason_code") <= 64`,
    ),
    check(
      "business_audit_before_summary_shape",
      sql`"before_summary" IS NULL OR (jsonb_typeof("before_summary") = 'object' AND pg_column_size("before_summary") <= 4096)`,
    ),
    check(
      "business_audit_after_summary_shape",
      sql`"after_summary" IS NULL OR (jsonb_typeof("after_summary") = 'object' AND pg_column_size("after_summary") <= 4096)`,
    ),
    check(
      "business_audit_metadata_shape",
      sql`"metadata" IS NULL OR (jsonb_typeof("metadata") = 'object' AND pg_column_size("metadata") <= 4096)`,
    ),
  ],
);

/**
 * Immutable append-only journal for security-sensitive audit records.
 */
export const securityAuditJournal = logosSchema.table(
  "security_audit_journal",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    tokyoArchiveDate: date("tokyo_archive_date").generatedAlwaysAs(
      sql`(timezone('Asia/Tokyo', "recorded_at"))::date`,
    ),
    schemaVersion: integer("schema_version").notNull().default(1),
    actorId: uuid("actor_id"),
    actorType: text("actor_type").notNull(),
    actorRoleSnapshot: text("actor_role_snapshot").notNull(),
    source: text("source").notNull(),
    correlationId: uuid("correlation_id").notNull(),
    category: text("category").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    result: text("result").notNull(),
    reasonCode: text("reason_code"),
    metadata: jsonb("metadata"),
  },
  (t) => [
    index("security_audit_tokyo_date_idx").on(t.tokyoArchiveDate, t.recordedAt),
    index("security_audit_correlation_idx").on(t.correlationId),
    check(
      "security_audit_actor_type_check",
      sql`"actor_type" IN ('system', 'user', 'anonymous', 'scheduled')`,
    ),
    check(
      "security_audit_result_check",
      sql`"result" IN ('success', 'failed', 'denied', 'rate_limited')`,
    ),
    check(
      "security_audit_category_len_check",
      sql`char_length("category") <= 64`,
    ),
    check("security_audit_action_len_check", sql`char_length("action") <= 64`),
    check(
      "security_audit_target_type_len_check",
      sql`char_length("target_type") <= 64`,
    ),
    check(
      "security_audit_target_id_len_check",
      sql`char_length("target_id") <= 128`,
    ),
    check(
      "security_audit_reason_code_len_check",
      sql`"reason_code" IS NULL OR char_length("reason_code") <= 64`,
    ),
    check(
      "security_audit_metadata_shape",
      sql`"metadata" IS NULL OR (jsonb_typeof("metadata") = 'object' AND pg_column_size("metadata") <= 4096)`,
    ),
  ],
);

/**
 * Lifecycle status enum for durable operations.
 */
export const operationStatusEnum = logosSchema.enum("operation_status", [
  "pending",
  "processing",
  "succeeded",
  "failed",
  "ambiguous",
]);

/**
 * Durable operations queue and execution tracking table.
 */
export const durableOperations = logosSchema.table(
  "durable_operations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    correlationId: uuid("correlation_id").notNull(),
    auditEventId: uuid("audit_event_id")
      .notNull()
      .references(() => businessAuditJournal.id, { onDelete: "restrict" }),
    type: text("type").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: operationStatusEnum("status").notNull().default("pending"),
    payload: jsonb("payload").notNull(),
    attemptCount: integer("attempt_count").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    availableAt: timestamp("available_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    leaseToken: text("lease_token"),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    providerReference: text("provider_reference"),
    failureCode: text("failure_code"),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    unique("durable_operations_type_idempotency_key").on(
      t.type,
      t.idempotencyKey,
    ),
    index("durable_operations_pending_idx")
      .on(t.status, t.availableAt, t.leaseExpiresAt)
      .where(sql`"status" IN ('pending', 'processing')`),
    index("durable_operations_lookup_idx").on(t.type, t.idempotencyKey),
    index("durable_operations_correlation_idx").on(t.correlationId),
    index("durable_operations_audit_event_idx").on(t.auditEventId),
    check("durable_operations_type_len_check", sql`char_length("type") <= 64`),
    check(
      "durable_operations_idempotency_key_len_check",
      sql`char_length("idempotency_key") <= 128`,
    ),
    check(
      "durable_operations_provider_ref_len_check",
      sql`"provider_reference" IS NULL OR char_length("provider_reference") <= 256`,
    ),
    check(
      "durable_operations_failure_code_len_check",
      sql`"failure_code" IS NULL OR char_length("failure_code") <= 64`,
    ),
    check(
      "durable_operations_last_error_len_check",
      sql`"last_error" IS NULL OR char_length("last_error") <= 1024`,
    ),
    check(
      "durable_operations_lease_token_len_check",
      sql`"lease_token" IS NULL OR char_length("lease_token") <= 128`,
    ),
    check(
      "durable_operations_attempts_check",
      sql`"attempt_count" >= 0 AND "attempt_count" <= "max_attempts"`,
    ),
    check(
      "durable_operations_payload_shape",
      sql`jsonb_typeof("payload") = 'object' AND pg_column_size("payload") <= 16384`,
    ),
    check(
      "durable_operations_timestamps_order",
      sql`"updated_at" >= "created_at"`,
    ),
  ],
);

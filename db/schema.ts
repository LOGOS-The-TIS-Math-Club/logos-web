import { sql } from "drizzle-orm";
import {
  boolean,
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
  uniqueIndex,
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

export const affiliationStatusEnum = logosSchema.enum("affiliation_status", [
  "pending_verification",
  "verified",
  "revoked",
]);

export const affiliationEvidenceTypeEnum = logosSchema.enum(
  "affiliation_evidence_type",
  ["google_hd", "manual_review", "revocation"],
);

export const technicalAccessLevelEnum = logosSchema.enum(
  "technical_access_level",
  ["basic", "operator", "access_admin"],
);

/**
 * LOGOS-owned identity association. Provider identifiers are immutable keys;
 * email remains mutable display/contact data and is never used as a join key.
 */
export const applicationIdentities = logosSchema.table(
  "application_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    neonAuthUserId: text("neon_auth_user_id").notNull(),
    googleSubject: text("google_subject").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull(),
    affiliationStatus: affiliationStatusEnum("affiliation_status")
      .notNull()
      .default("pending_verification"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
  },
  (t) => [
    unique("application_identities_neon_auth_user_id_key").on(t.neonAuthUserId),
    unique("application_identities_google_subject_key").on(t.googleSubject),
    index("application_identities_access_lookup_idx").on(
      t.neonAuthUserId,
      t.active,
      t.affiliationStatus,
    ),
    check(
      "application_identities_neon_user_len_check",
      sql`char_length("neon_auth_user_id") BETWEEN 1 AND 255`,
    ),
    check(
      "application_identities_google_subject_len_check",
      sql`char_length("google_subject") BETWEEN 1 AND 255`,
    ),
    check(
      "application_identities_email_len_check",
      sql`char_length("email") BETWEEN 3 AND 320`,
    ),
    check(
      "application_identities_deactivation_check",
      sql`("active" AND "deactivated_at" IS NULL) OR (NOT "active" AND "deactivated_at" IS NOT NULL)`,
    ),
  ],
);

/** Append-only normalized affiliation evidence; raw OIDC tokens are forbidden. */
export const affiliationEvidence = logosSchema.table(
  "affiliation_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identityId: uuid("identity_id")
      .notNull()
      .references(() => applicationIdentities.id, { onDelete: "restrict" }),
    status: affiliationStatusEnum("status").notNull(),
    evidenceType: affiliationEvidenceTypeEnum("evidence_type").notNull(),
    hostedDomain: text("hosted_domain"),
    verifiedByIdentityId: uuid("verified_by_identity_id").references(
      () => applicationIdentities.id,
      { onDelete: "restrict" },
    ),
    reasonCode: text("reason_code").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index("affiliation_evidence_identity_recorded_idx").on(
      t.identityId,
      t.recordedAt,
    ),
    check(
      "affiliation_evidence_domain_len_check",
      sql`"hosted_domain" IS NULL OR char_length("hosted_domain") BETWEEN 1 AND 253`,
    ),
    check(
      "affiliation_evidence_reason_len_check",
      sql`char_length("reason_code") BETWEEN 1 AND 64`,
    ),
    check(
      "affiliation_evidence_google_domain_check",
      sql`"status" <> 'verified' OR "hosted_domain" IS NOT NULL`,
    ),
  ],
);

/** Historical technical access assignments. Active assignments are unique. */
export const technicalAccessAssignments = logosSchema.table(
  "technical_access_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identityId: uuid("identity_id")
      .notNull()
      .references(() => applicationIdentities.id, { onDelete: "restrict" }),
    accessLevel: technicalAccessLevelEnum("access_level").notNull(),
    grantedByIdentityId: uuid("granted_by_identity_id").references(
      () => applicationIdentities.id,
      { onDelete: "restrict" },
    ),
    grantReasonCode: text("grant_reason_code").notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByIdentityId: uuid("revoked_by_identity_id").references(
      () => applicationIdentities.id,
      { onDelete: "restrict" },
    ),
    revokeReasonCode: text("revoke_reason_code"),
  },
  (t) => [
    uniqueIndex("technical_access_assignments_one_active_idx")
      .on(t.identityId)
      .where(sql`"revoked_at" IS NULL`),
    index("technical_access_assignments_active_lookup_idx")
      .on(t.identityId, t.accessLevel)
      .where(sql`"revoked_at" IS NULL`),
    check(
      "technical_access_assignments_grant_reason_len_check",
      sql`char_length("grant_reason_code") BETWEEN 1 AND 64`,
    ),
    check(
      "technical_access_assignments_revoke_reason_len_check",
      sql`"revoke_reason_code" IS NULL OR char_length("revoke_reason_code") BETWEEN 1 AND 64`,
    ),
    check(
      "technical_access_assignments_revocation_check",
      sql`("revoked_at" IS NULL AND "revoked_by_identity_id" IS NULL AND "revoke_reason_code" IS NULL) OR ("revoked_at" IS NOT NULL AND "revoke_reason_code" IS NOT NULL)`,
    ),
  ],
);

/** Singleton gate consumed by the first verified access administrator. */
export const accessBootstrapState = logosSchema.table(
  "access_bootstrap_state",
  {
    id: integer("id").primaryKey(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }).notNull(),
    identityId: uuid("identity_id")
      .notNull()
      .references(() => applicationIdentities.id, { onDelete: "restrict" }),
    auditEventId: uuid("audit_event_id")
      .notNull()
      .references(() => businessAuditJournal.id, { onDelete: "restrict" }),
  },
  (t) => [
    check("access_bootstrap_state_singleton_check", sql`"id" = 1`),
    unique("access_bootstrap_state_identity_key").on(t.identityId),
  ],
);

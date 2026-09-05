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

export const studentApplicationStatusEnum = logosSchema.enum(
  "student_application_status",
  ["submitted", "reviewing", "accepted", "declined"],
);

/**
 * Student applications submitted during recruitment cycles.
 * Bound to immutable verified Google application identities.
 */
export const studentApplications = logosSchema.table(
  "student_applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identityId: uuid("identity_id")
      .notNull()
      .references(() => applicationIdentities.id, { onDelete: "restrict" }),
    preferredName: text("preferred_name").notNull(),
    grade: text("grade").notNull(),
    academicInterests: jsonb("academic_interests").notNull().$type<string[]>(),
    joinReason: text("join_reason").notNull(),
    goals: text("goals").notNull(),
    experience: text("experience"),
    /*
     * Added after the first intake. Nullable so the migration stays additive
     * and existing rows remain valid; new submissions are completed at the
     * application layer instead. mathCourse is optional by design — course
     * level is the kind of thing a student may not want to share.
     */
    mathCourse: text("math_course"),
    contestInterest: text("contest_interest"),
    presentInterest: text("present_interest"),
    attendanceConfirmation: text("attendance_confirmation").notNull(),
    accuracyAcknowledged: boolean("accuracy_acknowledged")
      .notNull()
      .default(true),
    status: studentApplicationStatusEnum("status")
      .notNull()
      .default("submitted"),
    statusReason: text("status_reason"),
    reviewedByIdentityId: uuid("reviewed_by_identity_id").references(
      () => applicationIdentities.id,
      { onDelete: "restrict" },
    ),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    statusUpdatedAt: timestamp("status_updated_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    uniqueIndex("student_applications_identity_idx").on(t.identityId),
    index("student_applications_status_submitted_idx").on(
      t.status,
      t.submittedAt,
    ),
    check(
      "student_applications_preferred_name_len_check",
      sql`char_length("preferred_name") BETWEEN 1 AND 80`,
    ),
    check(
      "student_applications_grade_check",
      sql`"grade" IN ('Grade 9', 'Grade 10', 'Grade 11', 'Grade 12')`,
    ),
    check(
      "student_applications_academic_interests_check",
      sql`jsonb_typeof("academic_interests") = 'array' AND jsonb_array_length("academic_interests") BETWEEN 1 AND 8`,
    ),
    check(
      "student_applications_join_reason_len_check",
      sql`char_length("join_reason") BETWEEN 30 AND 500`,
    ),
    check(
      "student_applications_goals_len_check",
      sql`char_length("goals") BETWEEN 30 AND 500`,
    ),
    check(
      "student_applications_experience_len_check",
      sql`"experience" IS NULL OR char_length("experience") <= 500`,
    ),
    check(
      "student_applications_math_course_check",
      sql`"math_course" IS NULL OR "math_course" IN ('myp_standard', 'myp_extended', 'dp_aa_sl', 'dp_aa_hl', 'dp_ai_sl', 'dp_ai_hl', 'other', 'prefer_not_to_say')`,
    ),
    check(
      "student_applications_contest_interest_check",
      sql`"contest_interest" IS NULL OR "contest_interest" IN ('yes', 'maybe', 'no')`,
    ),
    check(
      "student_applications_present_interest_check",
      sql`"present_interest" IS NULL OR "present_interest" IN ('yes', 'maybe', 'no')`,
    ),
    check(
      "student_applications_attendance_check",
      sql`"attendance_confirmation" IN ('regular', 'occasional_conflicts', 'conflict')`,
    ),
    check(
      "student_applications_status_reason_len_check",
      sql`"status_reason" IS NULL OR char_length("status_reason") <= 256`,
    ),
    check(
      "student_applications_acknowledged_check",
      sql`"accuracy_acknowledged" = true`,
    ),
  ],
);

/*
 * Public announcements.
 *
 * Exists so leadership can change what the site says without a code change and
 * a redeploy. Drafts are rows with published = false; the public read only ever
 * selects published rows, so an unfinished notice is never reachable.
 */
export const announcements = logosSchema.table(
  "announcements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    published: boolean("published").notNull().default(false),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdByIdentityId: uuid("created_by_identity_id")
      .notNull()
      .references(() => applicationIdentities.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index("announcements_published_idx").on(t.published, t.publishedAt),
    check(
      "announcements_title_len_check",
      sql`char_length("title") BETWEEN 1 AND 120`,
    ),
    check(
      "announcements_body_len_check",
      sql`char_length("body") BETWEEN 1 AND 2000`,
    ),
    // A published row must record when it went live, so the public ordering
    // can never fall back to an implicit or missing timestamp.
    check(
      "announcements_published_at_check",
      sql`("published" = false AND "published_at" IS NULL) OR ("published" = true AND "published_at" IS NOT NULL)`,
    ),
  ],
);

export const clubMemberStatusEnum = logosSchema.enum("club_member_status", [
  "active",
  "inactive",
  "former",
]);

/**
 * Native LOGOS club memberships deliberately created from accepted applications.
 */
export const clubMembers = logosSchema.table(
  "club_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    identityId: uuid("identity_id")
      .notNull()
      .references(() => applicationIdentities.id, { onDelete: "restrict" }),
    applicationId: uuid("application_id").references(
      () => studentApplications.id,
      { onDelete: "restrict" },
    ),
    status: clubMemberStatusEnum("status").notNull().default("active"),
    /*
     * Two names, deliberately separate.
     *
     * displayName is the member's own, editable by them, and is what member
     * facing surfaces show. rosterName is set by leadership and is what
     * leadership surfaces show. Keeping them apart means a member renaming
     * themselves cannot change how they appear on the roster leadership works
     * from, and a leadership correction does not overwrite what the member
     * chose to be called.
     *
     * Both are nullable: null means "no override", and the name falls back to
     * the preferred name from the application.
     */
    displayName: text("display_name"),
    rosterName: text("roster_name"),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    leftAt: timestamp("left_at", { withTimezone: true }),
    statusReason: text("status_reason"),
    createdByIdentityId: uuid("created_by_identity_id")
      .notNull()
      .references(() => applicationIdentities.id, { onDelete: "restrict" }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    uniqueIndex("club_members_identity_active_idx")
      .on(t.identityId)
      .where(sql`"status" = 'active'`),
    index("club_members_status_joined_idx").on(t.status, t.joinedAt),
    index("club_members_application_idx").on(t.applicationId),
    check(
      "club_members_display_name_len_check",
      sql`"display_name" IS NULL OR char_length("display_name") BETWEEN 1 AND 80`,
    ),
    check(
      "club_members_roster_name_len_check",
      sql`"roster_name" IS NULL OR char_length("roster_name") BETWEEN 1 AND 80`,
    ),
    check(
      "club_members_status_reason_len_check",
      sql`"status_reason" IS NULL OR char_length("status_reason") <= 256`,
    ),
    check(
      "club_members_left_at_check",
      sql`("status" = 'active' AND "left_at" IS NULL) OR ("status" IN ('inactive', 'former') AND "left_at" IS NOT NULL)`,
    ),
  ],
);

/**
 * Club sessions created by leadership.
 */
/*
 * The resource cards on the member dashboard.
 *
 * Classroom and Drive links were hard-coded in the view, so changing one meant
 * a deploy and only a developer could do it. They are rows now, and leadership
 * can add more.
 */
export const clubResources = logosSchema.table(
  "club_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    url: text("url").notNull(),
    /** Ascending. Ties break on title so the order is never arbitrary. */
    sortOrder: integer("sort_order").notNull().default(0),
    createdByIdentityId: uuid("created_by_identity_id")
      .notNull()
      .references(() => applicationIdentities.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index("club_resources_order_idx").on(t.sortOrder, t.title),
    check(
      "club_resources_title_len_check",
      sql`char_length("title") BETWEEN 1 AND 80`,
    ),
    check(
      "club_resources_description_len_check",
      sql`char_length("description") BETWEEN 1 AND 280`,
    ),
    /*
     * https only, enforced in the database as well as in the form. These links
     * are rendered as anchors on a members-only page, so a javascript: or
     * data: URL saved here would be a stored cross-site scripting vector. The
     * constraint means that cannot be reached by any path, including SQL run
     * by hand.
     */
    check(
      "club_resources_url_check",
      sql`"url" LIKE 'https://%' AND char_length("url") BETWEEN 12 AND 2048`,
    ),
  ],
);

export const clubSessions = logosSchema.table(
  "club_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull().default("LOGOS Weekly Meeting"),
    sessionDate: date("session_date").notNull(),
    startTime: text("start_time").notNull().default("15:30"),
    endTime: text("end_time").notNull().default("16:30"),
    location: text("location").notNull().default("Room 101"),
    notes: text("notes"),
    /*
     * The Drive folder holding this session's materials, if it has one.
     *
     * Only the folder id is stored. File names and links are read from Drive
     * at request time rather than copied here, so the club never keeps a stale
     * second copy of a listing, and Drive's own permissions stay the only
     * thing deciding who can open a file.
     */
    driveFolderId: text("drive_folder_id"),
    createdByIdentityId: uuid("created_by_identity_id")
      .notNull()
      .references(() => applicationIdentities.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index("club_sessions_date_idx").on(t.sessionDate),
    check(
      "club_sessions_drive_folder_len_check",
      sql`"drive_folder_id" IS NULL OR char_length("drive_folder_id") BETWEEN 1 AND 128`,
    ),
    check(
      "club_sessions_title_len_check",
      sql`char_length("title") BETWEEN 1 AND 120`,
    ),
    check(
      "club_sessions_start_time_len_check",
      sql`char_length("start_time") BETWEEN 1 AND 10`,
    ),
    check(
      "club_sessions_end_time_len_check",
      sql`char_length("end_time") BETWEEN 1 AND 10`,
    ),
    check(
      "club_sessions_location_len_check",
      sql`char_length("location") BETWEEN 1 AND 100`,
    ),
    check(
      "club_sessions_notes_len_check",
      sql`"notes" IS NULL OR char_length("notes") <= 500`,
    ),
  ],
);

export const expectedAbsenceStatusEnum = logosSchema.enum(
  "expected_absence_status",
  ["submitted", "acknowledged", "cancelled"],
);

/**
 * Expected absences submitted ahead of club sessions.
 */
export const expectedAbsences = logosSchema.table(
  "expected_absences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => clubMembers.id, { onDelete: "restrict" }),
    sessionId: uuid("session_id").references(() => clubSessions.id, {
      onDelete: "restrict",
    }),
    sessionDate: date("session_date").notNull(),
    reason: text("reason").notNull(),
    status: expectedAbsenceStatusEnum("status").notNull().default("submitted"),
    submittedByIdentityId: uuid("submitted_by_identity_id")
      .notNull()
      .references(() => applicationIdentities.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    index("expected_absences_member_date_idx").on(t.memberId, t.sessionDate),
    index("expected_absences_session_idx").on(t.sessionId),
    check(
      "expected_absences_reason_len_check",
      sql`char_length("reason") BETWEEN 1 AND 500`,
    ),
  ],
);

export const attendanceStatusEnum = logosSchema.enum("attendance_status", [
  "unmarked",
  "present",
  "late",
  "excused_absence",
  "unexcused_absence",
]);

/**
 * Actual attendance ledger entries recorded by leadership.
 */
export const sessionAttendance = logosSchema.table(
  "session_attendance",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => clubSessions.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => clubMembers.id, { onDelete: "restrict" }),
    status: attendanceStatusEnum("status").notNull().default("unmarked"),
    notes: text("notes"),
    recordedByIdentityId: uuid("recorded_by_identity_id")
      .notNull()
      .references(() => applicationIdentities.id, { onDelete: "restrict" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
  },
  (t) => [
    uniqueIndex("session_attendance_session_member_idx").on(
      t.sessionId,
      t.memberId,
    ),
    index("session_attendance_member_idx").on(t.memberId),
    index("session_attendance_session_idx").on(t.sessionId),
    check(
      "session_attendance_notes_len_check",
      sql`"notes" IS NULL OR char_length("notes") <= 256`,
    ),
  ],
);

/**
 * Deliberate manual warnings recorded by leadership.
 */
export const memberWarnings = logosSchema.table(
  "member_warnings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => clubMembers.id, { onDelete: "restrict" }),
    issuedByIdentityId: uuid("issued_by_identity_id")
      .notNull()
      .references(() => applicationIdentities.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .default(sql`clock_timestamp()`),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedByIdentityId: uuid("resolved_by_identity_id").references(
      () => applicationIdentities.id,
      { onDelete: "restrict" },
    ),
  },
  (t) => [
    index("member_warnings_member_active_idx").on(t.memberId, t.active),
    check(
      "member_warnings_reason_len_check",
      sql`char_length("reason") BETWEEN 1 AND 256`,
    ),
    check(
      "member_warnings_notes_len_check",
      sql`"notes" IS NULL OR char_length("notes") <= 500`,
    ),
    check(
      "member_warnings_resolution_check",
      sql`("active" AND "resolved_at" IS NULL AND "resolved_by_identity_id" IS NULL) OR (NOT "active" AND "resolved_at" IS NOT NULL)`,
    ),
  ],
);

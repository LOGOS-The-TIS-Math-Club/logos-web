CREATE TYPE "logos"."operation_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'ambiguous');--> statement-breakpoint
CREATE TABLE "logos"."business_audit_journal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"tokyo_archive_date" date GENERATED ALWAYS AS ((timezone('Asia/Tokyo', "recorded_at"))::date) STORED,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"actor_id" uuid,
	"actor_type" text NOT NULL,
	"actor_role_snapshot" text NOT NULL,
	"source" text NOT NULL,
	"correlation_id" uuid NOT NULL,
	"category" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"result" text NOT NULL,
	"reason_code" text,
	"before_summary" jsonb,
	"after_summary" jsonb,
	"metadata" jsonb,
	CONSTRAINT "business_audit_actor_type_check" CHECK ("actor_type" IN ('system', 'user', 'anonymous', 'scheduled')),
	CONSTRAINT "business_audit_result_check" CHECK ("result" IN ('success', 'failed', 'denied')),
	CONSTRAINT "business_audit_category_len_check" CHECK (char_length("category") <= 64),
	CONSTRAINT "business_audit_action_len_check" CHECK (char_length("action") <= 64),
	CONSTRAINT "business_audit_target_type_len_check" CHECK (char_length("target_type") <= 64),
	CONSTRAINT "business_audit_target_id_len_check" CHECK (char_length("target_id") <= 128),
	CONSTRAINT "business_audit_reason_code_len_check" CHECK ("reason_code" IS NULL OR char_length("reason_code") <= 64),
	CONSTRAINT "business_audit_before_summary_shape" CHECK ("before_summary" IS NULL OR (jsonb_typeof("before_summary") = 'object' AND pg_column_size("before_summary") <= 4096)),
	CONSTRAINT "business_audit_after_summary_shape" CHECK ("after_summary" IS NULL OR (jsonb_typeof("after_summary") = 'object' AND pg_column_size("after_summary") <= 4096)),
	CONSTRAINT "business_audit_metadata_shape" CHECK ("metadata" IS NULL OR (jsonb_typeof("metadata") = 'object' AND pg_column_size("metadata") <= 4096))
);
--> statement-breakpoint
CREATE TABLE "logos"."durable_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"correlation_id" uuid NOT NULL,
	"audit_event_id" uuid NOT NULL,
	"type" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" "logos"."operation_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"available_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"lease_token" text,
	"lease_expires_at" timestamp with time zone,
	"provider_reference" text,
	"failure_code" text,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "durable_operations_type_idempotency_key" UNIQUE("type","idempotency_key"),
	CONSTRAINT "durable_operations_type_len_check" CHECK (char_length("type") <= 64),
	CONSTRAINT "durable_operations_idempotency_key_len_check" CHECK (char_length("idempotency_key") <= 128),
	CONSTRAINT "durable_operations_provider_ref_len_check" CHECK ("provider_reference" IS NULL OR char_length("provider_reference") <= 256),
	CONSTRAINT "durable_operations_failure_code_len_check" CHECK ("failure_code" IS NULL OR char_length("failure_code") <= 64),
	CONSTRAINT "durable_operations_last_error_len_check" CHECK ("last_error" IS NULL OR char_length("last_error") <= 1024),
	CONSTRAINT "durable_operations_lease_token_len_check" CHECK ("lease_token" IS NULL OR char_length("lease_token") <= 128),
	CONSTRAINT "durable_operations_attempts_check" CHECK ("attempt_count" >= 0 AND "attempt_count" <= "max_attempts"),
	CONSTRAINT "durable_operations_payload_shape" CHECK (jsonb_typeof("payload") = 'object' AND pg_column_size("payload") <= 16384),
	CONSTRAINT "durable_operations_timestamps_order" CHECK ("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE TABLE "logos"."rate_limits" (
	"subject_hash" text NOT NULL,
	"policy" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "rate_limits_pk" PRIMARY KEY("subject_hash","policy","window_start"),
	CONSTRAINT "rate_limits_policy_check" CHECK (char_length("policy") > 0 AND char_length("policy") <= 64),
	CONSTRAINT "rate_limits_subject_hash_check" CHECK ("subject_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "rate_limits_count_check" CHECK ("count" > 0)
);
--> statement-breakpoint
CREATE TABLE "logos"."security_audit_journal" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"tokyo_archive_date" date GENERATED ALWAYS AS ((timezone('Asia/Tokyo', "recorded_at"))::date) STORED,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"actor_id" uuid,
	"actor_type" text NOT NULL,
	"actor_role_snapshot" text NOT NULL,
	"source" text NOT NULL,
	"correlation_id" uuid NOT NULL,
	"category" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"result" text NOT NULL,
	"reason_code" text,
	"metadata" jsonb,
	CONSTRAINT "security_audit_actor_type_check" CHECK ("actor_type" IN ('system', 'user', 'anonymous', 'scheduled')),
	CONSTRAINT "security_audit_result_check" CHECK ("result" IN ('success', 'failed', 'denied', 'rate_limited')),
	CONSTRAINT "security_audit_category_len_check" CHECK (char_length("category") <= 64),
	CONSTRAINT "security_audit_action_len_check" CHECK (char_length("action") <= 64),
	CONSTRAINT "security_audit_target_type_len_check" CHECK (char_length("target_type") <= 64),
	CONSTRAINT "security_audit_target_id_len_check" CHECK (char_length("target_id") <= 128),
	CONSTRAINT "security_audit_reason_code_len_check" CHECK ("reason_code" IS NULL OR char_length("reason_code") <= 64),
	CONSTRAINT "security_audit_metadata_shape" CHECK ("metadata" IS NULL OR (jsonb_typeof("metadata") = 'object' AND pg_column_size("metadata") <= 4096))
);
--> statement-breakpoint
ALTER TABLE "logos"."durable_operations" ADD CONSTRAINT "durable_operations_audit_event_id_business_audit_journal_id_fk" FOREIGN KEY ("audit_event_id") REFERENCES "logos"."business_audit_journal"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "business_audit_tokyo_date_idx" ON "logos"."business_audit_journal" USING btree ("tokyo_archive_date","recorded_at");--> statement-breakpoint
CREATE INDEX "business_audit_correlation_idx" ON "logos"."business_audit_journal" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "business_audit_target_idx" ON "logos"."business_audit_journal" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "durable_operations_pending_idx" ON "logos"."durable_operations" USING btree ("status","available_at","lease_expires_at") WHERE "status" IN ('pending', 'processing');--> statement-breakpoint
CREATE INDEX "durable_operations_lookup_idx" ON "logos"."durable_operations" USING btree ("type","idempotency_key");--> statement-breakpoint
CREATE INDEX "durable_operations_correlation_idx" ON "logos"."durable_operations" USING btree ("correlation_id");--> statement-breakpoint
CREATE INDEX "durable_operations_audit_event_idx" ON "logos"."durable_operations" USING btree ("audit_event_id");--> statement-breakpoint
CREATE INDEX "rate_limits_window_idx" ON "logos"."rate_limits" USING btree ("window_start");--> statement-breakpoint
CREATE INDEX "security_audit_tokyo_date_idx" ON "logos"."security_audit_journal" USING btree ("tokyo_archive_date","recorded_at");--> statement-breakpoint
CREATE INDEX "security_audit_correlation_idx" ON "logos"."security_audit_journal" USING btree ("correlation_id");--> statement-breakpoint
REVOKE ALL ON TABLE logos.business_audit_journal FROM logos_runtime;--> statement-breakpoint
GRANT INSERT ON TABLE logos.business_audit_journal TO logos_runtime;--> statement-breakpoint
REVOKE ALL ON TABLE logos.security_audit_journal FROM logos_runtime;--> statement-breakpoint
GRANT INSERT ON TABLE logos.security_audit_journal TO logos_runtime;--> statement-breakpoint
GRANT USAGE ON SCHEMA logos TO logos_audit;--> statement-breakpoint
REVOKE ALL ON TABLE logos.business_audit_journal FROM logos_audit;--> statement-breakpoint
GRANT INSERT ON TABLE logos.business_audit_journal TO logos_audit;--> statement-breakpoint
REVOKE ALL ON TABLE logos.security_audit_journal FROM logos_audit;--> statement-breakpoint
GRANT INSERT ON TABLE logos.security_audit_journal TO logos_audit;--> statement-breakpoint
REVOKE ALL ON TABLE logos.durable_operations FROM logos_runtime;--> statement-breakpoint
GRANT INSERT, SELECT ON TABLE logos.durable_operations TO logos_runtime;--> statement-breakpoint
REVOKE ALL ON TABLE logos.rate_limits FROM logos_runtime;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE logos.rate_limits TO logos_runtime;--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA logos TO logos_backup;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.claim_durable_operation(
  p_worker_id text DEFAULT NULL,
  p_lease_duration interval DEFAULT interval '60 seconds',
  p_limit integer DEFAULT 1
)
RETURNS SETOF logos.durable_operations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, logos, pg_temp
AS $$
DECLARE
  v_limit integer;
  v_lease_duration interval;
BEGIN
  IF p_worker_id IS NOT NULL AND char_length(p_worker_id) > 256 THEN
    RAISE EXCEPTION 'Worker reference exceeds maximum length of 256 characters';
  END IF;

  IF p_lease_duration IS NOT NULL AND (p_lease_duration < interval '1 second' OR p_lease_duration > interval '3600 seconds') THEN
    RAISE EXCEPTION 'Lease duration must be between 1 second and 3600 seconds';
  END IF;

  IF p_limit IS NOT NULL AND (p_limit < 1 OR p_limit > 100) THEN
    RAISE EXCEPTION 'Claim limit must be between 1 and 100';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 1), 100));
  v_lease_duration := GREATEST(interval '1 second', LEAST(COALESCE(p_lease_duration, interval '60 seconds'), interval '3600 seconds'));

  RETURN QUERY
  WITH selected AS (
    SELECT op.id
    FROM logos.durable_operations op
    WHERE (
      (op.status = 'pending' AND op.available_at <= clock_timestamp())
      OR
      (op.status = 'processing' AND op.lease_expires_at < clock_timestamp())
    )
    AND op.attempt_count < op.max_attempts
    ORDER BY op.available_at ASC, op.created_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT v_limit
  )
  UPDATE logos.durable_operations op
  SET
    status = 'processing',
    lease_token = gen_random_uuid()::text,
    provider_reference = p_worker_id,
    attempt_count = op.attempt_count + 1,
    lease_expires_at = clock_timestamp() + v_lease_duration,
    updated_at = clock_timestamp()
  FROM selected
  WHERE op.id = selected.id
  RETURNING op.*;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION logos.claim_durable_operation(text, interval, integer) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION logos.claim_durable_operation(text, interval, integer) TO logos_runtime;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.complete_durable_operation(
  p_id uuid,
  p_lease_token text,
  p_status logos.operation_status,
  p_provider_reference text DEFAULT NULL,
  p_failure_code text DEFAULT NULL,
  p_last_error text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, logos, pg_temp
AS $$
DECLARE
  v_updated integer;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Operation ID cannot be null';
  END IF;

  IF p_lease_token IS NULL OR char_length(p_lease_token) = 0 OR char_length(p_lease_token) > 128 THEN
    RAISE EXCEPTION 'Invalid lease token';
  END IF;

  IF p_status NOT IN ('succeeded', 'failed', 'ambiguous') THEN
    RAISE EXCEPTION 'Invalid completion status: %', p_status;
  END IF;

  IF p_provider_reference IS NOT NULL AND char_length(p_provider_reference) > 256 THEN
    RAISE EXCEPTION 'Provider reference exceeds maximum length of 256 characters';
  END IF;

  IF p_failure_code IS NOT NULL AND char_length(p_failure_code) > 64 THEN
    RAISE EXCEPTION 'Failure code exceeds maximum length of 64 characters';
  END IF;

  IF p_last_error IS NOT NULL AND char_length(p_last_error) > 1024 THEN
    RAISE EXCEPTION 'Last error exceeds maximum length of 1024 characters';
  END IF;

  UPDATE logos.durable_operations
  SET
    status = p_status,
    lease_token = NULL,
    lease_expires_at = NULL,
    provider_reference = COALESCE(p_provider_reference, provider_reference),
    failure_code = COALESCE(p_failure_code, failure_code),
    last_error = COALESCE(p_last_error, last_error),
    completed_at = clock_timestamp(),
    updated_at = clock_timestamp()
  WHERE id = p_id
    AND status = 'processing'
    AND lease_token = p_lease_token
    AND lease_expires_at >= clock_timestamp();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION logos.complete_durable_operation(uuid, text, logos.operation_status, text, text, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION logos.complete_durable_operation(uuid, text, logos.operation_status, text, text, text) TO logos_runtime;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.fail_durable_operation(
  p_id uuid,
  p_lease_token text,
  p_failure_code text DEFAULT NULL,
  p_last_error text DEFAULT NULL,
  p_retry_delay interval DEFAULT interval '30 seconds'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, logos, pg_temp
AS $$
DECLARE
  v_updated integer;
  v_current_attempts integer;
  v_max_attempts integer;
  v_retry_delay interval;
BEGIN
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Operation ID cannot be null';
  END IF;

  IF p_lease_token IS NULL OR char_length(p_lease_token) = 0 OR char_length(p_lease_token) > 128 THEN
    RAISE EXCEPTION 'Invalid lease token';
  END IF;

  IF p_failure_code IS NOT NULL AND char_length(p_failure_code) > 64 THEN
    RAISE EXCEPTION 'Failure code exceeds maximum length of 64 characters';
  END IF;

  IF p_last_error IS NOT NULL AND char_length(p_last_error) > 1024 THEN
    RAISE EXCEPTION 'Last error exceeds maximum length of 1024 characters';
  END IF;

  IF p_retry_delay IS NOT NULL AND (p_retry_delay < interval '1 second' OR p_retry_delay > interval '604800 seconds') THEN
    RAISE EXCEPTION 'Retry delay must be between 1 second and 604800 seconds (7 days)';
  END IF;

  v_retry_delay := GREATEST(interval '1 second', LEAST(COALESCE(p_retry_delay, interval '30 seconds'), interval '604800 seconds'));

  SELECT attempt_count, max_attempts INTO v_current_attempts, v_max_attempts
  FROM logos.durable_operations
  WHERE id = p_id
    AND status = 'processing'
    AND lease_token = p_lease_token
    AND lease_expires_at >= clock_timestamp();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_current_attempts >= v_max_attempts THEN
    UPDATE logos.durable_operations
    SET
      status = 'failed',
      lease_token = NULL,
      lease_expires_at = NULL,
      failure_code = COALESCE(p_failure_code, failure_code, 'MAX_ATTEMPTS_EXCEEDED'),
      last_error = COALESCE(p_last_error, last_error),
      completed_at = clock_timestamp(),
      updated_at = clock_timestamp()
    WHERE id = p_id
      AND status = 'processing'
      AND lease_token = p_lease_token
      AND lease_expires_at >= clock_timestamp();
  ELSE
    UPDATE logos.durable_operations
    SET
      status = 'pending',
      lease_token = NULL,
      lease_expires_at = NULL,
      failure_code = COALESCE(p_failure_code, failure_code),
      last_error = COALESCE(p_last_error, last_error),
      available_at = clock_timestamp() + v_retry_delay,
      updated_at = clock_timestamp()
    WHERE id = p_id
      AND status = 'processing'
      AND lease_token = p_lease_token
      AND lease_expires_at >= clock_timestamp();
  END IF;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION logos.fail_durable_operation(uuid, text, text, text, interval) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION logos.fail_durable_operation(uuid, text, text, text, interval) TO logos_runtime;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.search_audit_journal(
  p_journal_type text,
  p_limit integer DEFAULT 25,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_correlation_id uuid DEFAULT NULL,
  p_actor_id uuid DEFAULT NULL,
  p_target_type text DEFAULT NULL,
  p_target_id text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  recorded_at timestamp with time zone,
  tokyo_archive_date date,
  schema_version integer,
  actor_id uuid,
  actor_type text,
  actor_role_snapshot text,
  source text,
  correlation_id uuid,
  category text,
  action text,
  target_type text,
  target_id text,
  result text,
  reason_code text,
  before_summary jsonb,
  after_summary jsonb,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, logos, pg_temp
AS $$
DECLARE
  v_limit integer;
BEGIN
  IF p_journal_type NOT IN ('business', 'security') THEN
    RAISE EXCEPTION 'Invalid journal type: %. Must be ''business'' or ''security''.', p_journal_type;
  END IF;

  IF p_start_date IS NULL
     AND p_end_date IS NULL
     AND p_correlation_id IS NULL
     AND p_actor_id IS NULL
     AND p_target_type IS NULL
     AND p_target_id IS NULL THEN
    RAISE EXCEPTION 'Bounded search requires at least one narrowing filter (date, correlation_id, actor_id, or target).';
  END IF;

  IF p_limit IS NOT NULL AND (p_limit < 1 OR p_limit > 100) THEN
    RAISE EXCEPTION 'Limit must be between 1 and 100';
  END IF;

  IF p_target_type IS NOT NULL AND char_length(p_target_type) > 64 THEN
    RAISE EXCEPTION 'Target type exceeds 64 characters';
  END IF;

  IF p_target_id IS NOT NULL AND char_length(p_target_id) > 128 THEN
    RAISE EXCEPTION 'Target ID exceeds 128 characters';
  END IF;

  IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_start_date > p_end_date THEN
    RAISE EXCEPTION 'Start date cannot be after end date';
  END IF;

  v_limit := GREATEST(1, LEAST(COALESCE(p_limit, 25), 100));

  IF p_journal_type = 'business' THEN
    RETURN QUERY
    SELECT
      j.id,
      j.recorded_at,
      j.tokyo_archive_date,
      j.schema_version,
      j.actor_id,
      j.actor_type,
      j.actor_role_snapshot,
      j.source,
      j.correlation_id,
      j.category,
      j.action,
      j.target_type,
      j.target_id,
      j.result,
      j.reason_code,
      j.before_summary,
      j.after_summary,
      j.metadata
    FROM logos.business_audit_journal j
    WHERE (p_start_date IS NULL OR j.tokyo_archive_date >= p_start_date)
      AND (p_end_date IS NULL OR j.tokyo_archive_date <= p_end_date)
      AND (p_correlation_id IS NULL OR j.correlation_id = p_correlation_id)
      AND (p_actor_id IS NULL OR j.actor_id = p_actor_id)
      AND (p_target_type IS NULL OR j.target_type = p_target_type)
      AND (p_target_id IS NULL OR j.target_id = p_target_id)
    ORDER BY j.recorded_at DESC, j.id DESC
    LIMIT v_limit;
  ELSE
    RETURN QUERY
    SELECT
      s.id,
      s.recorded_at,
      s.tokyo_archive_date,
      s.schema_version,
      s.actor_id,
      s.actor_type,
      s.actor_role_snapshot,
      s.source,
      s.correlation_id,
      s.category,
      s.action,
      s.target_type,
      s.target_id,
      s.result,
      s.reason_code,
      NULL::jsonb AS before_summary,
      NULL::jsonb AS after_summary,
      s.metadata
    FROM logos.security_audit_journal s
    WHERE (p_start_date IS NULL OR s.tokyo_archive_date >= p_start_date)
      AND (p_end_date IS NULL OR s.tokyo_archive_date <= p_end_date)
      AND (p_correlation_id IS NULL OR s.correlation_id = p_correlation_id)
      AND (p_actor_id IS NULL OR s.actor_id = p_actor_id)
      AND (p_target_type IS NULL OR s.target_type = p_target_type)
      AND (p_target_id IS NULL OR s.target_id = p_target_id)
    ORDER BY s.recorded_at DESC, s.id DESC
    LIMIT v_limit;
  END IF;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION logos.search_audit_journal(text, integer, date, date, uuid, uuid, text, text) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION logos.search_audit_journal(text, integer, date, date, uuid, uuid, text, text) TO logos_runtime;
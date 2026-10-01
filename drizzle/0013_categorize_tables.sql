CREATE SCHEMA IF NOT EXISTS people;--> statement-breakpoint
GRANT USAGE ON SCHEMA people TO logos_runtime, logos_backup, logos_migration;--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS applications;--> statement-breakpoint
GRANT USAGE ON SCHEMA applications TO logos_runtime, logos_backup, logos_migration;--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS members;--> statement-breakpoint
GRANT USAGE ON SCHEMA members TO logos_runtime, logos_backup, logos_migration;--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS meetings;--> statement-breakpoint
GRANT USAGE ON SCHEMA meetings TO logos_runtime, logos_backup, logos_migration;--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS content;--> statement-breakpoint
GRANT USAGE ON SCHEMA content TO logos_runtime, logos_backup, logos_migration;--> statement-breakpoint
CREATE SCHEMA IF NOT EXISTS operations;--> statement-breakpoint
GRANT USAGE ON SCHEMA operations TO logos_runtime, logos_backup, logos_migration;--> statement-breakpoint
GRANT USAGE ON SCHEMA operations TO logos_audit;--> statement-breakpoint
ALTER TABLE logos.access_bootstrap_state SET SCHEMA people;--> statement-breakpoint
ALTER TABLE logos.affiliation_evidence SET SCHEMA people;--> statement-breakpoint
ALTER TABLE logos.announcements SET SCHEMA content;--> statement-breakpoint
ALTER TABLE logos.application_identities SET SCHEMA people;--> statement-breakpoint
ALTER TABLE logos.business_audit_journal SET SCHEMA operations;--> statement-breakpoint
ALTER TABLE logos.club_members SET SCHEMA members;--> statement-breakpoint
ALTER TABLE logos.club_resources SET SCHEMA content;--> statement-breakpoint
ALTER TABLE logos.club_sessions SET SCHEMA meetings;--> statement-breakpoint
ALTER TABLE logos.durable_operations SET SCHEMA operations;--> statement-breakpoint
ALTER TABLE logos.expected_absences SET SCHEMA meetings;--> statement-breakpoint
ALTER TABLE logos.images SET SCHEMA content;--> statement-breakpoint
ALTER TABLE logos.infrastructure_probe SET SCHEMA operations;--> statement-breakpoint
ALTER TABLE logos.member_warnings SET SCHEMA members;--> statement-breakpoint
ALTER TABLE logos.rate_limits SET SCHEMA operations;--> statement-breakpoint
ALTER TABLE logos.security_audit_journal SET SCHEMA operations;--> statement-breakpoint
ALTER TABLE logos.session_attendance SET SCHEMA meetings;--> statement-breakpoint
ALTER TABLE logos.story_entries SET SCHEMA content;--> statement-breakpoint
ALTER TABLE logos.student_applications SET SCHEMA applications;--> statement-breakpoint
ALTER TABLE logos.technical_access_assignments SET SCHEMA people;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.associate_application_identity(p_neon_auth_user_id text, p_google_subject text, p_email text, p_email_verified boolean, p_hosted_domain text)
 RETURNS TABLE(identity_id uuid, affiliation_status text, active boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'logos', 'pg_temp'
AS $function$
DECLARE
  v_identity people.application_identities%ROWTYPE;
  v_previous_status logos.affiliation_status;
  v_next_status logos.affiliation_status;
  v_domain text;
BEGIN
  IF NOT p_email_verified THEN
    RAISE EXCEPTION 'verified email required' USING ERRCODE = '22023';
  END IF;

  v_domain := NULLIF(lower(btrim(p_hosted_domain)), '');
  v_next_status := CASE
    WHEN v_domain = 'tokyois.com' THEN 'verified'::logos.affiliation_status
    ELSE 'pending_verification'::logos.affiliation_status
  END;

  SELECT i.affiliation_status
    INTO v_previous_status
  FROM people.application_identities i
  WHERE i.neon_auth_user_id = p_neon_auth_user_id
  FOR UPDATE;

  INSERT INTO people.application_identities (
    neon_auth_user_id,
    google_subject,
    email,
    email_verified,
    affiliation_status
  ) VALUES (
    p_neon_auth_user_id,
    p_google_subject,
    lower(btrim(p_email)),
    true,
    v_next_status
  )
  ON CONFLICT (neon_auth_user_id) DO UPDATE
    SET email = EXCLUDED.email,
        email_verified = true,
        updated_at = clock_timestamp(),
        affiliation_status = CASE
          WHEN people.application_identities.affiliation_status = 'revoked'
            THEN people.application_identities.affiliation_status
          ELSE EXCLUDED.affiliation_status
        END
    WHERE people.application_identities.google_subject = EXCLUDED.google_subject
  RETURNING * INTO v_identity;

  IF v_identity.id IS NULL THEN
    RAISE EXCEPTION 'immutable identity association mismatch' USING ERRCODE = '23000';
  END IF;

  IF v_previous_status IS NULL OR v_previous_status IS DISTINCT FROM v_identity.affiliation_status THEN
    INSERT INTO people.affiliation_evidence (
      identity_id,
      status,
      evidence_type,
      hosted_domain,
      reason_code
    ) VALUES (
      v_identity.id,
      v_identity.affiliation_status,
      'google_hd',
      v_domain,
      CASE
        WHEN v_identity.affiliation_status = 'verified' THEN 'google_hd_approved'
        ELSE 'google_hd_pending'
      END
    );
  END IF;

  RETURN QUERY SELECT v_identity.id, v_identity.affiliation_status::text, v_identity.active;
END;
$function$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.bootstrap_access_admin(p_identity_id uuid, p_audit_event_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'logos', 'pg_temp'
AS $function$
DECLARE
  v_assignment_id uuid;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('logos-access-bootstrap'));

  IF EXISTS (SELECT 1 FROM people.access_bootstrap_state WHERE id = 1) THEN
    RAISE EXCEPTION 'access bootstrap already consumed' USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM people.application_identities i
    WHERE i.id = p_identity_id
      AND i.active
      AND i.email_verified
      AND i.affiliation_status = 'verified'
  ) THEN
    RAISE EXCEPTION 'bootstrap identity is not eligible' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM people.technical_access_assignments a
    WHERE a.access_level = 'access_admin' AND a.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'active access administrator already exists' USING ERRCODE = '55000';
  END IF;

  INSERT INTO people.technical_access_assignments (
    identity_id, access_level, grant_reason_code
  ) VALUES (
    p_identity_id, 'access_admin', 'initial_bootstrap'
  ) RETURNING id INTO v_assignment_id;

  INSERT INTO people.access_bootstrap_state (id, consumed_at, identity_id, audit_event_id)
  VALUES (1, clock_timestamp(), p_identity_id, p_audit_event_id);

  RETURN v_assignment_id;
END;
$function$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.claim_durable_operation(p_worker_id text DEFAULT NULL::text, p_lease_duration interval DEFAULT '00:01:00'::interval, p_limit integer DEFAULT 1)
 RETURNS SETOF operations.durable_operations
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'logos', 'pg_temp'
AS $function$
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
    FROM operations.durable_operations op
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
  UPDATE operations.durable_operations op
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
$function$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.complete_durable_operation(p_id uuid, p_lease_token text, p_status logos.operation_status, p_provider_reference text DEFAULT NULL::text, p_failure_code text DEFAULT NULL::text, p_last_error text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'logos', 'pg_temp'
AS $function$
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

  UPDATE operations.durable_operations
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
$function$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.deactivate_application_identity(p_actor_identity_id uuid, p_target_identity_id uuid, p_reason_code text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'logos', 'pg_temp'
AS $function$
DECLARE
  v_count integer;
  v_neon_auth_user_id text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM people.application_identities i
    JOIN people.technical_access_assignments a ON a.identity_id = i.id
    WHERE i.id = p_actor_identity_id
      AND i.active
      AND i.affiliation_status = 'verified'
      AND a.access_level = 'access_admin'
      AND a.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'access administrator required' USING ERRCODE = '42501';
  END IF;

  UPDATE people.application_identities
  SET active = false,
      affiliation_status = 'revoked',
      deactivated_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE id = p_target_identity_id AND active
  RETURNING neon_auth_user_id INTO v_neon_auth_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    UPDATE people.technical_access_assignments
    SET revoked_at = clock_timestamp(),
        revoked_by_identity_id = p_actor_identity_id,
        revoke_reason_code = p_reason_code
    WHERE identity_id = p_target_identity_id AND revoked_at IS NULL;

    INSERT INTO people.affiliation_evidence (
      identity_id, status, evidence_type, verified_by_identity_id, reason_code
    ) VALUES (
      p_target_identity_id, 'revoked', 'revocation', p_actor_identity_id, p_reason_code
    );
  END IF;

  RETURN v_neon_auth_user_id;
END;
$function$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.fail_durable_operation(p_id uuid, p_lease_token text, p_failure_code text DEFAULT NULL::text, p_last_error text DEFAULT NULL::text, p_retry_delay interval DEFAULT '00:00:30'::interval)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'logos', 'pg_temp'
AS $function$
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
  FROM operations.durable_operations
  WHERE id = p_id
    AND status = 'processing'
    AND lease_token = p_lease_token
    AND lease_expires_at >= clock_timestamp();

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_current_attempts >= v_max_attempts THEN
    UPDATE operations.durable_operations
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
    UPDATE operations.durable_operations
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
$function$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.resolve_identity_access(p_neon_auth_user_id text)
 RETURNS TABLE(identity_id uuid, email text, affiliation_status text, active boolean, access_level text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'logos', 'pg_temp'
AS $function$
  SELECT
    i.id,
    i.email,
    i.affiliation_status::text,
    i.active,
    a.access_level::text
  FROM people.application_identities i
  LEFT JOIN people.technical_access_assignments a
    ON a.identity_id = i.id AND a.revoked_at IS NULL
  WHERE i.neon_auth_user_id = p_neon_auth_user_id
  LIMIT 1
$function$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.revoke_technical_access(p_actor_identity_id uuid, p_target_identity_id uuid, p_reason_code text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'logos', 'pg_temp'
AS $function$
DECLARE
  v_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM people.application_identities i
    JOIN people.technical_access_assignments a ON a.identity_id = i.id
    WHERE i.id = p_actor_identity_id
      AND i.active
      AND i.affiliation_status = 'verified'
      AND a.access_level = 'access_admin'
      AND a.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'access administrator required' USING ERRCODE = '42501';
  END IF;

  UPDATE people.technical_access_assignments
  SET revoked_at = clock_timestamp(),
      revoked_by_identity_id = p_actor_identity_id,
      revoke_reason_code = p_reason_code
  WHERE identity_id = p_target_identity_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$function$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.search_audit_journal(p_journal_type text, p_limit integer DEFAULT 25, p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_correlation_id uuid DEFAULT NULL::uuid, p_actor_id uuid DEFAULT NULL::uuid, p_target_type text DEFAULT NULL::text, p_target_id text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, recorded_at timestamp with time zone, tokyo_archive_date date, schema_version integer, actor_id uuid, actor_type text, actor_role_snapshot text, source text, correlation_id uuid, category text, action text, target_type text, target_id text, result text, reason_code text, before_summary jsonb, after_summary jsonb, metadata jsonb)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'logos', 'pg_temp'
AS $function$
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
    FROM operations.business_audit_journal j
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
    FROM operations.security_audit_journal s
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
$function$;--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.set_technical_access(p_actor_identity_id uuid, p_target_identity_id uuid, p_access_level logos.technical_access_level, p_reason_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'logos', 'pg_temp'
AS $function$
DECLARE
  v_assignment_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM people.application_identities i
    JOIN people.technical_access_assignments a ON a.identity_id = i.id
    WHERE i.id = p_actor_identity_id
      AND i.active
      AND i.affiliation_status = 'verified'
      AND a.access_level = 'access_admin'
      AND a.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'access administrator required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM people.application_identities i
    WHERE i.id = p_target_identity_id
      AND i.active
      AND i.affiliation_status = 'verified'
  ) THEN
    RAISE EXCEPTION 'target identity is not eligible' USING ERRCODE = '42501';
  END IF;

  UPDATE people.technical_access_assignments
  SET revoked_at = clock_timestamp(),
      revoked_by_identity_id = p_actor_identity_id,
      revoke_reason_code = 'replaced'
  WHERE identity_id = p_target_identity_id AND revoked_at IS NULL;

  INSERT INTO people.technical_access_assignments (
    identity_id, access_level, granted_by_identity_id, grant_reason_code
  ) VALUES (
    p_target_identity_id, p_access_level, p_actor_identity_id, p_reason_code
  ) RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$function$;

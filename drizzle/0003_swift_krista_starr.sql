CREATE TYPE "logos"."affiliation_evidence_type" AS ENUM('google_hd', 'manual_review', 'revocation');--> statement-breakpoint
CREATE TYPE "logos"."affiliation_status" AS ENUM('pending_verification', 'verified', 'revoked');--> statement-breakpoint
CREATE TYPE "logos"."technical_access_level" AS ENUM('basic', 'operator', 'access_admin');--> statement-breakpoint
CREATE TABLE "logos"."access_bootstrap_state" (
	"id" integer PRIMARY KEY NOT NULL,
	"consumed_at" timestamp with time zone NOT NULL,
	"identity_id" uuid NOT NULL,
	"audit_event_id" uuid NOT NULL,
	CONSTRAINT "access_bootstrap_state_identity_key" UNIQUE("identity_id"),
	CONSTRAINT "access_bootstrap_state_singleton_check" CHECK ("id" = 1)
);
--> statement-breakpoint
CREATE TABLE "logos"."affiliation_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"status" "logos"."affiliation_status" NOT NULL,
	"evidence_type" "logos"."affiliation_evidence_type" NOT NULL,
	"hosted_domain" text,
	"verified_by_identity_id" uuid,
	"reason_code" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "affiliation_evidence_domain_len_check" CHECK ("hosted_domain" IS NULL OR char_length("hosted_domain") BETWEEN 1 AND 253),
	CONSTRAINT "affiliation_evidence_reason_len_check" CHECK (char_length("reason_code") BETWEEN 1 AND 64),
	CONSTRAINT "affiliation_evidence_google_domain_check" CHECK ("status" <> 'verified' OR "hosted_domain" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "logos"."application_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"neon_auth_user_id" text NOT NULL,
	"google_subject" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean NOT NULL,
	"affiliation_status" "logos"."affiliation_status" DEFAULT 'pending_verification' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"deactivated_at" timestamp with time zone,
	CONSTRAINT "application_identities_neon_auth_user_id_key" UNIQUE("neon_auth_user_id"),
	CONSTRAINT "application_identities_google_subject_key" UNIQUE("google_subject"),
	CONSTRAINT "application_identities_neon_user_len_check" CHECK (char_length("neon_auth_user_id") BETWEEN 1 AND 255),
	CONSTRAINT "application_identities_google_subject_len_check" CHECK (char_length("google_subject") BETWEEN 1 AND 255),
	CONSTRAINT "application_identities_email_len_check" CHECK (char_length("email") BETWEEN 3 AND 320),
	CONSTRAINT "application_identities_deactivation_check" CHECK (("active" AND "deactivated_at" IS NULL) OR (NOT "active" AND "deactivated_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "logos"."technical_access_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"access_level" "logos"."technical_access_level" NOT NULL,
	"granted_by_identity_id" uuid,
	"grant_reason_code" text NOT NULL,
	"granted_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"revoked_at" timestamp with time zone,
	"revoked_by_identity_id" uuid,
	"revoke_reason_code" text,
	CONSTRAINT "technical_access_assignments_grant_reason_len_check" CHECK (char_length("grant_reason_code") BETWEEN 1 AND 64),
	CONSTRAINT "technical_access_assignments_revoke_reason_len_check" CHECK ("revoke_reason_code" IS NULL OR char_length("revoke_reason_code") BETWEEN 1 AND 64),
	CONSTRAINT "technical_access_assignments_revocation_check" CHECK (("revoked_at" IS NULL AND "revoked_by_identity_id" IS NULL AND "revoke_reason_code" IS NULL) OR ("revoked_at" IS NOT NULL AND "revoke_reason_code" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "logos"."access_bootstrap_state" ADD CONSTRAINT "access_bootstrap_state_identity_id_application_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."access_bootstrap_state" ADD CONSTRAINT "access_bootstrap_state_audit_event_id_business_audit_journal_id_fk" FOREIGN KEY ("audit_event_id") REFERENCES "logos"."business_audit_journal"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."affiliation_evidence" ADD CONSTRAINT "affiliation_evidence_identity_id_application_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."affiliation_evidence" ADD CONSTRAINT "affiliation_evidence_verified_by_identity_id_application_identities_id_fk" FOREIGN KEY ("verified_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."technical_access_assignments" ADD CONSTRAINT "technical_access_assignments_identity_id_application_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."technical_access_assignments" ADD CONSTRAINT "technical_access_assignments_granted_by_identity_id_application_identities_id_fk" FOREIGN KEY ("granted_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."technical_access_assignments" ADD CONSTRAINT "technical_access_assignments_revoked_by_identity_id_application_identities_id_fk" FOREIGN KEY ("revoked_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "affiliation_evidence_identity_recorded_idx" ON "logos"."affiliation_evidence" USING btree ("identity_id","recorded_at");--> statement-breakpoint
CREATE INDEX "application_identities_access_lookup_idx" ON "logos"."application_identities" USING btree ("neon_auth_user_id","active","affiliation_status");--> statement-breakpoint
CREATE UNIQUE INDEX "technical_access_assignments_one_active_idx" ON "logos"."technical_access_assignments" USING btree ("identity_id") WHERE "revoked_at" IS NULL;--> statement-breakpoint
CREATE INDEX "technical_access_assignments_active_lookup_idx" ON "logos"."technical_access_assignments" USING btree ("identity_id","access_level") WHERE "revoked_at" IS NULL;
--> statement-breakpoint
REVOKE ALL ON TABLE logos.application_identities FROM PUBLIC, logos_runtime, logos_audit;
--> statement-breakpoint
REVOKE ALL ON TABLE logos.affiliation_evidence FROM PUBLIC, logos_runtime, logos_audit;
--> statement-breakpoint
REVOKE ALL ON TABLE logos.technical_access_assignments FROM PUBLIC, logos_runtime, logos_audit;
--> statement-breakpoint
REVOKE ALL ON TABLE logos.access_bootstrap_state FROM PUBLIC, logos_runtime, logos_audit;
--> statement-breakpoint
GRANT SELECT ON TABLE logos.application_identities, logos.affiliation_evidence,
  logos.technical_access_assignments, logos.access_bootstrap_state TO logos_backup;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.associate_application_identity(
  p_neon_auth_user_id text,
  p_google_subject text,
  p_email text,
  p_email_verified boolean,
  p_hosted_domain text
)
RETURNS TABLE (
  identity_id uuid,
  affiliation_status text,
  active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, logos, pg_temp
AS $$
DECLARE
  v_identity logos.application_identities%ROWTYPE;
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
  FROM logos.application_identities i
  WHERE i.neon_auth_user_id = p_neon_auth_user_id
  FOR UPDATE;

  INSERT INTO logos.application_identities (
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
          WHEN logos.application_identities.affiliation_status = 'revoked'
            THEN logos.application_identities.affiliation_status
          ELSE EXCLUDED.affiliation_status
        END
    WHERE logos.application_identities.google_subject = EXCLUDED.google_subject
  RETURNING * INTO v_identity;

  IF v_identity.id IS NULL THEN
    RAISE EXCEPTION 'immutable identity association mismatch' USING ERRCODE = '23000';
  END IF;

  IF v_previous_status IS NULL OR v_previous_status IS DISTINCT FROM v_identity.affiliation_status THEN
    INSERT INTO logos.affiliation_evidence (
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
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION logos.associate_application_identity(text, text, text, boolean, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION logos.associate_application_identity(text, text, text, boolean, text) TO logos_runtime;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.resolve_identity_access(p_neon_auth_user_id text)
RETURNS TABLE (
  identity_id uuid,
  email text,
  affiliation_status text,
  active boolean,
  access_level text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, logos, pg_temp
AS $$
  SELECT
    i.id,
    i.email,
    i.affiliation_status::text,
    i.active,
    a.access_level::text
  FROM logos.application_identities i
  LEFT JOIN logos.technical_access_assignments a
    ON a.identity_id = i.id AND a.revoked_at IS NULL
  WHERE i.neon_auth_user_id = p_neon_auth_user_id
  LIMIT 1
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION logos.resolve_identity_access(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION logos.resolve_identity_access(text) TO logos_runtime;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.bootstrap_access_admin(
  p_identity_id uuid,
  p_audit_event_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, logos, pg_temp
AS $$
DECLARE
  v_assignment_id uuid;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('logos-access-bootstrap'));

  IF EXISTS (SELECT 1 FROM logos.access_bootstrap_state WHERE id = 1) THEN
    RAISE EXCEPTION 'access bootstrap already consumed' USING ERRCODE = '55000';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM logos.application_identities i
    WHERE i.id = p_identity_id
      AND i.active
      AND i.email_verified
      AND i.affiliation_status = 'verified'
  ) THEN
    RAISE EXCEPTION 'bootstrap identity is not eligible' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM logos.technical_access_assignments a
    WHERE a.access_level = 'access_admin' AND a.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'active access administrator already exists' USING ERRCODE = '55000';
  END IF;

  INSERT INTO logos.technical_access_assignments (
    identity_id, access_level, grant_reason_code
  ) VALUES (
    p_identity_id, 'access_admin', 'initial_bootstrap'
  ) RETURNING id INTO v_assignment_id;

  INSERT INTO logos.access_bootstrap_state (id, consumed_at, identity_id, audit_event_id)
  VALUES (1, clock_timestamp(), p_identity_id, p_audit_event_id);

  RETURN v_assignment_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION logos.bootstrap_access_admin(uuid, uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION logos.bootstrap_access_admin(uuid, uuid) FROM logos_runtime, logos_audit, logos_backup;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.set_technical_access(
  p_actor_identity_id uuid,
  p_target_identity_id uuid,
  p_access_level logos.technical_access_level,
  p_reason_code text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, logos, pg_temp
AS $$
DECLARE
  v_assignment_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM logos.application_identities i
    JOIN logos.technical_access_assignments a ON a.identity_id = i.id
    WHERE i.id = p_actor_identity_id
      AND i.active
      AND i.affiliation_status = 'verified'
      AND a.access_level = 'access_admin'
      AND a.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'access administrator required' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM logos.application_identities i
    WHERE i.id = p_target_identity_id
      AND i.active
      AND i.affiliation_status = 'verified'
  ) THEN
    RAISE EXCEPTION 'target identity is not eligible' USING ERRCODE = '42501';
  END IF;

  UPDATE logos.technical_access_assignments
  SET revoked_at = clock_timestamp(),
      revoked_by_identity_id = p_actor_identity_id,
      revoke_reason_code = 'replaced'
  WHERE identity_id = p_target_identity_id AND revoked_at IS NULL;

  INSERT INTO logos.technical_access_assignments (
    identity_id, access_level, granted_by_identity_id, grant_reason_code
  ) VALUES (
    p_target_identity_id, p_access_level, p_actor_identity_id, p_reason_code
  ) RETURNING id INTO v_assignment_id;

  RETURN v_assignment_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION logos.set_technical_access(uuid, uuid, logos.technical_access_level, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION logos.set_technical_access(uuid, uuid, logos.technical_access_level, text) TO logos_runtime;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.revoke_technical_access(
  p_actor_identity_id uuid,
  p_target_identity_id uuid,
  p_reason_code text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, logos, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM logos.application_identities i
    JOIN logos.technical_access_assignments a ON a.identity_id = i.id
    WHERE i.id = p_actor_identity_id
      AND i.active
      AND i.affiliation_status = 'verified'
      AND a.access_level = 'access_admin'
      AND a.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'access administrator required' USING ERRCODE = '42501';
  END IF;

  UPDATE logos.technical_access_assignments
  SET revoked_at = clock_timestamp(),
      revoked_by_identity_id = p_actor_identity_id,
      revoke_reason_code = p_reason_code
  WHERE identity_id = p_target_identity_id AND revoked_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count > 0;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION logos.revoke_technical_access(uuid, uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION logos.revoke_technical_access(uuid, uuid, text) TO logos_runtime;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION logos.deactivate_application_identity(
  p_actor_identity_id uuid,
  p_target_identity_id uuid,
  p_reason_code text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, logos, pg_temp
AS $$
DECLARE
  v_count integer;
  v_neon_auth_user_id text;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM logos.application_identities i
    JOIN logos.technical_access_assignments a ON a.identity_id = i.id
    WHERE i.id = p_actor_identity_id
      AND i.active
      AND i.affiliation_status = 'verified'
      AND a.access_level = 'access_admin'
      AND a.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'access administrator required' USING ERRCODE = '42501';
  END IF;

  UPDATE logos.application_identities
  SET active = false,
      affiliation_status = 'revoked',
      deactivated_at = clock_timestamp(),
      updated_at = clock_timestamp()
  WHERE id = p_target_identity_id AND active
  RETURNING neon_auth_user_id INTO v_neon_auth_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 THEN
    UPDATE logos.technical_access_assignments
    SET revoked_at = clock_timestamp(),
        revoked_by_identity_id = p_actor_identity_id,
        revoke_reason_code = p_reason_code
    WHERE identity_id = p_target_identity_id AND revoked_at IS NULL;

    INSERT INTO logos.affiliation_evidence (
      identity_id, status, evidence_type, verified_by_identity_id, reason_code
    ) VALUES (
      p_target_identity_id, 'revoked', 'revocation', p_actor_identity_id, p_reason_code
    );
  END IF;

  RETURN v_neon_auth_user_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION logos.deactivate_application_identity(uuid, uuid, text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION logos.deactivate_application_identity(uuid, uuid, text) TO logos_runtime;

-- Grant technical access to someone, by email.
--
-- Run in the Neon SQL editor (connects as neondb_owner). The access tables are
-- REVOKEd from every application role, so this cannot be done from the app.
--
-- WHICH LEVEL:
--
--   operator      Runs the club. Review applications, manage members, record
--                 attendance, issue warnings, post announcements. This is what
--                 /admin checks for. Almost certainly the one you want.
--
--   access_admin  Holds the keys, and NOTHING else. Assigns and revokes access
--                 and revokes sessions. It CANNOT open /admin or see a single
--                 application. Separation of duties, deliberately.
--
--   basic         Signed in, no tools.
--
-- An identity holds exactly one level at a time (enforced by a partial unique
-- index). Granting a new level revokes the previous one, which is why the same
-- account cannot be both operator and access_admin — give access_admin to the
-- durable club mailbox and operator to whoever is actually running the club.
--
-- Prerequisite: the person must have signed in with Google on the site at least
-- once. That is what creates the identity and marks a tokyois.com address
-- verified.

DO $$
DECLARE
  -- ─────────────────────────────────────────────────────────────────────
  v_email  text := 'mathclub@tokyois.com';
  v_level  text := 'operator';   -- operator | access_admin | basic
  -- ─────────────────────────────────────────────────────────────────────

  v_identity_id  uuid;
  v_active       boolean;
  v_affiliation  text;
  v_previous     text;
  v_assignment_id uuid;
BEGIN
  IF v_level NOT IN ('operator', 'access_admin', 'basic') THEN
    RAISE EXCEPTION 'v_level must be operator, access_admin or basic (got %)', v_level;
  END IF;

  SELECT id, active, affiliation_status::text
    INTO v_identity_id, v_active, v_affiliation
  FROM logos.application_identities
  WHERE lower(email) = lower(trim(v_email));

  IF v_identity_id IS NULL THEN
    RAISE EXCEPTION
      'No identity for %. Sign in once at the site with that Google account first — that is what creates it.',
      v_email;
  END IF;

  IF NOT v_active OR v_affiliation <> 'verified' THEN
    RAISE EXCEPTION
      'Identity for % is not eligible (active=%, affiliation=%). It must be an active, verified @tokyois.com account.',
      v_email, v_active, v_affiliation;
  END IF;

  -- Mirrors logos.set_technical_access: one active assignment per identity, so
  -- the previous one is revoked rather than left to collide with the unique
  -- index. Done directly because set_technical_access requires an existing
  -- access_admin to act as grantor, which does not exist on a cold start.
  SELECT access_level::text INTO v_previous
  FROM logos.technical_access_assignments
  WHERE identity_id = v_identity_id AND revoked_at IS NULL;

  UPDATE logos.technical_access_assignments
  SET revoked_at         = clock_timestamp(),
      revoke_reason_code = 'replaced'
  WHERE identity_id = v_identity_id AND revoked_at IS NULL;

  INSERT INTO logos.technical_access_assignments (
    identity_id, access_level, grant_reason_code
  ) VALUES (
    v_identity_id, v_level::logos.technical_access_level, 'manual_sql_grant'
  )
  RETURNING id INTO v_assignment_id;

  -- Access changes are the most sensitive thing in this system. A grant with no
  -- record of it would be the one privileged action nobody could review.
  INSERT INTO logos.business_audit_journal (
    actor_id, actor_type, actor_role_snapshot, source, correlation_id,
    category, action, target_type, target_id, result, reason_code,
    before_summary, after_summary
  ) VALUES (
    NULL, 'system', 'none', 'internal', gen_random_uuid(),
    'access', 'assign', 'application_identity', v_identity_id::text,
    'success', 'manual_sql_grant',
    jsonb_build_object('accessLevel', coalesce(v_previous, 'none')),
    jsonb_build_object('accessLevel', v_level)
  );

  RAISE NOTICE 'Granted % to % (was %, assignment %)',
    v_level, v_email, coalesce(v_previous, 'none'), v_assignment_id;
END $$;

-- Confirmation: every account that currently holds access.
SELECT
  i.email,
  a.access_level,
  a.grant_reason_code,
  a.granted_at
FROM logos.technical_access_assignments a
JOIN logos.application_identities i ON i.id = a.identity_id
WHERE a.revoked_at IS NULL
ORDER BY a.granted_at;

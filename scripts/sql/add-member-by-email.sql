-- Activate an applicant as an active club member.
--
-- Run in the Neon SQL editor (which connects as neondb_owner). The runtime role
-- deliberately cannot write logos.club_members, so this cannot be run from the
-- application's own connection.
--
-- Edit ONE line: v_member_email, below. Everything else resolves itself.
--
-- Preconditions, each checked with a readable error rather than a constraint
-- violation:
--   1. The student has signed in with Google at least once (creates identity).
--   2. The student has submitted an application.
--   3. They are not already an active member.
--   4. Some leadership account exists to attribute the grant to.
--
-- Prefer /admin → Applications → Activate when it is available. This script is
-- the escape hatch for when it is not.

DO $$
DECLARE
  -- ─────────────────────────────────────────────────────────────────────
  v_member_email    text := 'student.name@tokyois.com';
  -- ─────────────────────────────────────────────────────────────────────

  v_identity_id     uuid;
  v_application_id  uuid;
  v_app_status      text;
  v_preferred_name  text;
  v_actor_id        uuid;
  v_member_id       uuid;
BEGIN
  SELECT id INTO v_identity_id
  FROM logos.application_identities
  WHERE lower(email) = lower(trim(v_member_email));

  IF v_identity_id IS NULL THEN
    RAISE EXCEPTION
      'No identity for %. They must sign in with their @tokyois.com Google account at least once first.',
      v_member_email;
  END IF;

  SELECT id, status::text, preferred_name
    INTO v_application_id, v_app_status, v_preferred_name
  FROM logos.student_applications
  WHERE identity_id = v_identity_id;

  IF v_application_id IS NULL THEN
    RAISE EXCEPTION
      'No application found for %. They must submit the form at /apply first.',
      v_member_email;
  END IF;

  IF EXISTS (
    SELECT 1 FROM logos.club_members
    WHERE identity_id = v_identity_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION '% is already an active member.', v_member_email;
  END IF;

  -- Attribute the activation to a real leadership account. Membership is an
  -- operator capability, so prefer an operator; access_admin is only a fallback
  -- for a club that has not appointed one yet.
  SELECT a.identity_id INTO v_actor_id
  FROM logos.technical_access_assignments a
  WHERE a.revoked_at IS NULL
    AND a.access_level IN ('operator', 'access_admin')
  ORDER BY (a.access_level = 'operator') DESC, a.granted_at
  LIMIT 1;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION
      'No leadership account to attribute this to. Run grant-access-by-email.sql to make someone an operator first.';
  END IF;

  -- Membership is only ever activated from an accepted application, so bring the
  -- application to that state rather than leaving the admin list contradicting
  -- the members list.
  IF v_app_status <> 'accepted' THEN
    UPDATE logos.student_applications
    SET status                  = 'accepted',
        status_reason           = 'Accepted during manual activation',
        reviewed_by_identity_id = v_actor_id,
        status_updated_at       = clock_timestamp()
    WHERE id = v_application_id;
  END IF;

  INSERT INTO logos.club_members (
    identity_id, application_id, status, status_reason, created_by_identity_id
  ) VALUES (
    v_identity_id, v_application_id, 'active',
    'Activated manually by leadership', v_actor_id
  )
  RETURNING id INTO v_member_id;

  -- Every membership created through the app writes an audit row. A manual one
  -- that skipped this would be the only unexplained member on the list.
  INSERT INTO logos.business_audit_journal (
    actor_id, actor_type, actor_role_snapshot, source, correlation_id,
    category, action, target_type, target_id, result, reason_code, metadata
  ) VALUES (
    v_actor_id, 'user', 'leadership', 'internal', gen_random_uuid(),
    'membership', 'activate', 'club_member', v_member_id::text,
    'success', 'manual_sql_activation',
    jsonb_build_object(
      'applicationId',    v_application_id,
      'identityId',       v_identity_id,
      'preferredName',    v_preferred_name,
      'previousAppStatus', v_app_status
    )
  );

  RAISE NOTICE 'Activated % (%) as member %', v_preferred_name, v_member_email, v_member_id;
END $$;

-- Confirmation: the most recent members, newest first.
SELECT
  m.status,
  m.joined_at,
  i.email,
  a.preferred_name,
  a.grade
FROM logos.club_members m
JOIN logos.application_identities i ON i.id = m.identity_id
LEFT JOIN logos.student_applications a ON a.id = m.application_id
ORDER BY m.joined_at DESC
LIMIT 5;

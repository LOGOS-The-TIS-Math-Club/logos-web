-- Seed the 2026 programme into logos.club_sessions.
--
-- Run in the Neon SQL editor, once, after someone holds operator access.
--
-- The home and meetings pages read the programme from this table so leadership
-- can edit a date or a topic from /admin/sessions without a deploy. Until the
-- table has a row they fall back to the curriculum committed in
-- content/club.ts; this script moves that same list into the database so the
-- fallback stops being used and the list becomes editable.
--
-- Safe to re-run: a session is skipped if one already exists on that date, so
-- edits made in /admin are never overwritten.

DO $$
DECLARE
  v_actor_id uuid;
  v_inserted integer := 0;
  v_row      record;
BEGIN
  SELECT a.identity_id INTO v_actor_id
  FROM logos.technical_access_assignments a
  WHERE a.revoked_at IS NULL
    AND a.access_level IN ('operator', 'access_admin')
  ORDER BY (a.access_level = 'operator') DESC, a.granted_at
  LIMIT 1;

  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION
      'No leadership account to attribute these to. Run grant-access-by-email.sql first.';
  END IF;

  -- Fridays and topics from the official 2026 curriculum sheet.
  FOR v_row IN
    SELECT *
    FROM (VALUES
      ('2026-09-04'::date, 'Algebra diagnostic and introduction'),
      ('2026-09-11'::date, 'Multiplication identities and polynomial structure'),
      ('2026-09-18'::date, 'Factoring complex polynomial expressions'),
      ('2026-09-25'::date, 'Identities and undetermined coefficients'),
      ('2026-10-02'::date, 'Remainder theorem and factor theorem'),
      ('2026-10-09'::date, 'Real and complex numbers'),
      ('2026-10-30'::date, 'Roots, discriminants, and root–coefficient relationships'),
      ('2026-11-13'::date, 'Structural methods for cubic and quartic equations')
    ) AS programme(session_date, topic)
    ORDER BY session_date
  LOOP
    CONTINUE WHEN EXISTS (
      SELECT 1 FROM logos.club_sessions
      WHERE session_date = v_row.session_date
    );

    INSERT INTO logos.club_sessions (
      title, session_date, start_time, end_time, location,
      created_by_identity_id
    ) VALUES (
      v_row.topic, v_row.session_date, '15:30', '16:30', 'Room 101',
      v_actor_id
    );

    v_inserted := v_inserted + 1;
  END LOOP;

  RAISE NOTICE 'Seeded % session(s).', v_inserted;
END $$;

-- Confirmation: the programme as the public pages will now render it.
SELECT session_date, title, notes
FROM logos.club_sessions
ORDER BY session_date;

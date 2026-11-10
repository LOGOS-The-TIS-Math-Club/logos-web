-- Share submission eligibility between the write guard and applicant-facing reads.
CREATE FUNCTION applications.submission_blocker(p_identity uuid) RETURNS text
LANGUAGE sql VOLATILE AS $$
 SELECT CASE
   WHEN NOT EXISTS (SELECT 1 FROM people.identities WHERE id=p_identity AND enabled AND school_verified)
     THEN 'identity'
   WHEN EXISTS (SELECT 1 FROM applications.reapplication_restrictions WHERE identity_id=p_identity
     AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())) THEN 'restricted'
   WHEN EXISTS (SELECT 1 FROM members.current_roster WHERE identity_id=p_identity AND status IN ('active','paused'))
     THEN 'current_member'
   WHEN EXISTS (SELECT 1 FROM applications.submissions WHERE identity_id=p_identity AND status IN ('submitted','under_review'))
     THEN 'open_application'
   ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION applications.check_submission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE blocker text;
BEGIN
 PERFORM 1 FROM people.identities WHERE id=NEW.identity_id FOR UPDATE;
 blocker := applications.submission_blocker(NEW.identity_id);
 IF blocker='identity' THEN RAISE EXCEPTION 'Verified school identity required' USING ERRCODE='42501'; END IF;
 IF blocker='restricted' THEN RAISE EXCEPTION 'Reapplication restricted' USING ERRCODE='23514'; END IF;
 IF blocker='current_member' THEN RAISE EXCEPTION 'Already a current member' USING ERRCODE='23514'; END IF;
 IF blocker='open_application' THEN RAISE EXCEPTION 'An application is already open' USING ERRCODE='23505'; END IF;
 IF NEW.status <> 'submitted' THEN RAISE EXCEPTION 'New applications must be submitted' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END;
$$;

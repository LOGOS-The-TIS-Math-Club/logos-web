CREATE FUNCTION people.has_access(p_identity uuid, p_role text, p_on date DEFAULT (now() AT TIME ZONE 'Asia/Tokyo')::date)
RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS (
   SELECT 1 FROM people.identities i
   JOIN people.role_grants r ON r.identity_id = i.id
   WHERE i.id = p_identity AND i.enabled AND i.school_verified
   AND (r.role = 'admin' OR (p_role = 'member' AND r.role = 'member' AND EXISTS (
     SELECT 1 FROM members.memberships m JOIN members.state_periods s ON s.member_id = m.id
     WHERE m.identity_id = i.id AND s.status IN ('active','paused')
     AND s.starts_on <= p_on AND (s.ends_on IS NULL OR s.ends_on > p_on)
   ))) AND p_role IN ('admin','member')
 );
$$;
CREATE FUNCTION people.require_admin(p_actor uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF NOT people.has_access(p_actor, 'admin') THEN
   RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
 END IF;
END;
$$;

CREATE FUNCTION meetings.check_year_range() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM meetings.terms WHERE academic_year_id = NEW.id
   AND (starts_on < NEW.starts_on OR ends_on > NEW.ends_on)) THEN
   RAISE EXCEPTION 'Academic year would exclude existing terms' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER year_range BEFORE UPDATE ON meetings.academic_years FOR EACH ROW EXECUTE FUNCTION meetings.check_year_range();

-- Shared parent locks serialize date-range edits with child writes.
CREATE FUNCTION meetings.check_term_range() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE y meetings.academic_years;
BEGIN
 SELECT * INTO STRICT y FROM meetings.academic_years WHERE id = NEW.academic_year_id FOR UPDATE;
 IF NEW.starts_on < y.starts_on OR NEW.ends_on > y.ends_on THEN
   RAISE EXCEPTION 'Term must fit inside academic year' USING ERRCODE = '23514';
 END IF;
 IF EXISTS (SELECT 1 FROM meetings.terms t WHERE t.academic_year_id = y.id AND t.id <> NEW.id
   AND daterange(t.starts_on,t.ends_on,'[)') && daterange(NEW.starts_on,NEW.ends_on,'[)')) THEN
   RAISE EXCEPTION 'Terms in an academic year must not overlap' USING ERRCODE = '23514';
 END IF;
 IF EXISTS (SELECT 1 FROM meetings.sessions s WHERE s.term_id = NEW.id
   AND (s.starts_at_local::date < NEW.starts_on OR s.starts_at_local::date >= NEW.ends_on)) THEN
   RAISE EXCEPTION 'Term would exclude existing sessions' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER term_range BEFORE INSERT OR UPDATE ON meetings.terms FOR EACH ROW EXECUTE FUNCTION meetings.check_term_range();
CREATE FUNCTION meetings.check_session_range() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t meetings.terms;
BEGIN
 SELECT * INTO STRICT t FROM meetings.terms WHERE id = NEW.term_id FOR UPDATE;
 IF NEW.starts_at_local::date < t.starts_on OR NEW.starts_at_local::date >= t.ends_on THEN
   RAISE EXCEPTION 'Session must start inside term' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER session_range BEFORE INSERT OR UPDATE ON meetings.sessions FOR EACH ROW EXECUTE FUNCTION meetings.check_session_range();
CREATE FUNCTION applications.check_submission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE i people.identities;
BEGIN
 SELECT * INTO STRICT i FROM people.identities WHERE id = NEW.identity_id FOR UPDATE;
 IF NOT i.enabled OR NOT i.school_verified THEN
   RAISE EXCEPTION 'Verified school identity required' USING ERRCODE = '42501';
 END IF;
 IF EXISTS (SELECT 1 FROM applications.reapplication_restrictions r WHERE r.identity_id = i.id
   AND r.starts_at <= now() AND (r.ends_at IS NULL OR r.ends_at > now())) THEN
   RAISE EXCEPTION 'Reapplication restricted' USING ERRCODE = '23514';
 END IF;
 IF EXISTS (SELECT 1 FROM members.current_roster m WHERE m.identity_id = i.id AND m.status IN ('active','paused')) THEN
   RAISE EXCEPTION 'Already a current member' USING ERRCODE = '23514';
 END IF;
 IF NEW.status <> 'submitted' THEN RAISE EXCEPTION 'New applications must be submitted' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER submission_guard BEFORE INSERT ON applications.submissions FOR EACH ROW EXECUTE FUNCTION applications.check_submission();
CREATE FUNCTION applications.lock_restricted_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM 1 FROM people.identities WHERE id = NEW.identity_id FOR UPDATE;
 RETURN NEW;
END;
$$;
CREATE TRIGGER restriction_lock BEFORE INSERT OR UPDATE ON applications.reapplication_restrictions FOR EACH ROW EXECUTE FUNCTION applications.lock_restricted_identity();
CREATE FUNCTION applications.check_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.identity_id <> OLD.identity_id THEN RAISE EXCEPTION 'Application identity is immutable' USING ERRCODE = '23514'; END IF;
 IF NEW.status <> OLD.status AND NOT (
   (OLD.status = 'submitted' AND NEW.status IN ('under_review','accepted','rejected','withdrawn')) OR
   (OLD.status = 'under_review' AND NEW.status IN ('accepted','rejected','withdrawn'))
 ) THEN RAISE EXCEPTION 'Invalid application transition' USING ERRCODE = '23514'; END IF;
 IF NEW.member_id IS NOT NULL AND NOT EXISTS (
   SELECT 1 FROM members.memberships m WHERE m.id = NEW.member_id AND m.identity_id = NEW.identity_id
 ) THEN RAISE EXCEPTION 'Accepted membership must belong to applicant' USING ERRCODE = '23514'; END IF;
 IF NEW.status <> OLD.status THEN NEW.status_updated_at := now(); END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER application_transition BEFORE UPDATE ON applications.submissions FOR EACH ROW EXECUTE FUNCTION applications.check_transition();

CREATE FUNCTION applications.accept(p_actor uuid, p_application uuid, p_name text, p_grade integer,
 p_grade_year integer, p_start date, p_notes text) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE a applications.submissions; m uuid; person uuid;
BEGIN
 PERFORM people.require_admin(p_actor);
 SELECT identity_id INTO STRICT person FROM applications.submissions WHERE id = p_application;
 PERFORM 1 FROM people.identities WHERE id = person FOR UPDATE;
 SELECT * INTO STRICT a FROM applications.submissions WHERE id = p_application FOR UPDATE;
 -- A retry returns the original result without overwriting the reviewed member card.
 IF a.status = 'accepted' THEN RETURN a.member_id; END IF;
 IF a.status NOT IN ('submitted','under_review') THEN
   RAISE EXCEPTION 'Application is closed' USING ERRCODE = '23514';
 END IF;
 SELECT id INTO m FROM members.memberships WHERE identity_id = person FOR UPDATE;
 IF m IS NOT NULL AND EXISTS (SELECT 1 FROM members.state_changes WHERE member_id = m AND effective_on >= p_start) THEN
   RAISE EXCEPTION 'Rejoining must follow existing membership history' USING ERRCODE = '23514';
 END IF;
 IF m IS NOT NULL AND EXISTS (SELECT 1 FROM members.current_roster WHERE id = m AND status IN ('active','paused')) THEN
   RAISE EXCEPTION 'Already a current member' USING ERRCODE = '23514';
 END IF;
 INSERT INTO members.memberships(identity_id,display_name,grade,grade_academic_year)
 VALUES(person,p_name,p_grade,p_grade_year)
 ON CONFLICT(identity_id) DO UPDATE SET display_name = EXCLUDED.display_name, grade = EXCLUDED.grade,
 grade_academic_year = EXCLUDED.grade_academic_year RETURNING id INTO m;
 INSERT INTO members.private_notes(member_id,notes) VALUES(m,p_notes)
 ON CONFLICT(member_id) DO UPDATE SET notes = EXCLUDED.notes;
 INSERT INTO members.state_changes(member_id,effective_on,status,recorded_by) VALUES(m,p_start,'active',p_actor);
 INSERT INTO people.role_grants(identity_id,role,granted_by) VALUES(person,'member',p_actor) ON CONFLICT DO NOTHING;
 UPDATE applications.submissions SET status = 'accepted', member_id = m, reviewed_by = p_actor WHERE id = a.id;
 INSERT INTO operations.change_history(actor_id,action,entity_id,details)
 VALUES(p_actor,'application.accepted',a.id,jsonb_build_object('memberId',m));
 RETURN m;
END;
$$;

CREATE FUNCTION applications.transition(p_actor uuid, p_application uuid, p_status text, p_reason text DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE a applications.submissions;
BEGIN
 SELECT * INTO STRICT a FROM applications.submissions WHERE id = p_application FOR UPDATE;
 IF p_status = 'withdrawn' AND a.identity_id = p_actor THEN
   IF NOT EXISTS (SELECT 1 FROM people.identities WHERE id = p_actor AND enabled AND school_verified) THEN
     RAISE EXCEPTION 'Verified school identity required' USING ERRCODE = '42501';
   END IF;
 ELSE PERFORM people.require_admin(p_actor);
 END IF;
 IF p_status NOT IN ('under_review','rejected','withdrawn') THEN
   RAISE EXCEPTION 'Use acceptance operation to accept' USING ERRCODE = '23514';
 END IF;
 UPDATE applications.submissions SET status = p_status, status_reason = p_reason, reviewed_by = CASE WHEN p_status = 'withdrawn' THEN reviewed_by ELSE p_actor END WHERE id = a.id;
 INSERT INTO operations.change_history(actor_id,action,entity_id,details)
 VALUES(p_actor,'application.status_changed',a.id,jsonb_build_object('from',a.status,'to',p_status));
END;
$$;

CREATE FUNCTION members.change_state(p_actor uuid, p_member uuid, p_on date, p_status text, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM people.require_admin(p_actor);
 PERFORM 1 FROM members.memberships WHERE id = p_member FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Member not found' USING ERRCODE = 'P0002'; END IF;
 IF p_on < (SELECT min(effective_on) FROM members.state_changes WHERE member_id = p_member) THEN
   RAISE EXCEPTION 'State change cannot precede joining' USING ERRCODE = '23514';
 END IF;
 INSERT INTO members.state_changes(member_id,effective_on,status,departure_reason,recorded_by)
 VALUES(p_member,p_on,p_status,p_reason,p_actor);
 INSERT INTO operations.change_history(actor_id,action,entity_id,details)
 VALUES(p_actor,'membership.state_changed',p_member,jsonb_build_object('effectiveOn',p_on,'status',p_status,'reason',p_reason));
END;
$$;

CREATE FUNCTION meetings.eligible_attendance(p_member uuid, p_as_of timestamptz)
RETURNS TABLE(session_id uuid, status text) LANGUAGE sql STABLE AS $$
 SELECT s.id, coalesce(a.status,'unmarked')
 FROM meetings.session_times s
 JOIN members.state_periods p ON p.member_id = p_member AND p.status = 'active'
 AND s.starts_at_local::date >= p.starts_on AND (p.ends_on IS NULL OR s.starts_at_local::date < p.ends_on)
 LEFT JOIN meetings.attendance a ON a.session_id = s.id AND a.member_id = p_member
 WHERE s.status = 'scheduled' AND s.ends_at <= p_as_of;
$$;

CREATE FUNCTION meetings.record_attendance(p_actor uuid, p_member uuid, p_session uuid, p_status text, p_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE previous text;
BEGIN
 PERFORM people.require_admin(p_actor);
 -- Session lock also serializes corrections of a previously unmarked record.
 PERFORM 1 FROM meetings.sessions WHERE id = p_session FOR UPDATE;
 SELECT status INTO previous FROM meetings.attendance WHERE member_id = p_member AND session_id = p_session;
 INSERT INTO meetings.attendance(member_id,session_id,status,notes,recorded_by)
 VALUES(p_member,p_session,p_status,p_notes,p_actor)
 ON CONFLICT(member_id,session_id) DO UPDATE SET status = EXCLUDED.status, notes = EXCLUDED.notes,
 recorded_by = EXCLUDED.recorded_by, updated_at = now();
 INSERT INTO operations.change_history(actor_id,action,entity_id,details)
 VALUES(p_actor,'attendance.corrected',p_session,jsonb_build_object('memberId',p_member,'from',previous,'to',p_status));
END;
$$;

-- These functions are backend-only, invoker-rights operations, never public RPCs.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA people, applications, members, meetings FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA people, applications, members, meetings, content, operations FROM PUBLIC;

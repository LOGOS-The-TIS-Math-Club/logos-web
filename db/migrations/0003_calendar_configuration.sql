-- Historical sessions can wait for an admin to define the real term calendar.
ALTER TABLE meetings.sessions ADD COLUMN academic_year_id uuid REFERENCES meetings.academic_years ON DELETE RESTRICT;
UPDATE meetings.sessions s SET academic_year_id = t.academic_year_id FROM meetings.terms t WHERE s.term_id = t.id;
ALTER TABLE meetings.sessions ALTER COLUMN academic_year_id SET NOT NULL;
ALTER TABLE meetings.sessions ALTER COLUMN term_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION meetings.check_session_range() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE t meetings.terms; y meetings.academic_years;
BEGIN
 IF NEW.term_id IS NOT NULL THEN
   SELECT * INTO STRICT t FROM meetings.terms WHERE id = NEW.term_id FOR UPDATE;
   IF NEW.academic_year_id IS NULL THEN NEW.academic_year_id := t.academic_year_id; END IF;
   IF NEW.academic_year_id <> t.academic_year_id THEN
     RAISE EXCEPTION 'Session and term must share an academic year' USING ERRCODE = '23514';
   END IF;
   IF NEW.starts_at_local::date < t.starts_on OR NEW.starts_at_local::date >= t.ends_on THEN
     RAISE EXCEPTION 'Session must start inside term' USING ERRCODE = '23514';
   END IF;
 END IF;
 SELECT * INTO STRICT y FROM meetings.academic_years WHERE id = NEW.academic_year_id FOR UPDATE;
 IF NEW.starts_at_local::date < y.starts_on OR NEW.starts_at_local::date >= y.ends_on THEN
   RAISE EXCEPTION 'Session must start inside academic year' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION meetings.check_year_range() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM meetings.terms WHERE academic_year_id = NEW.id
   AND (starts_on < NEW.starts_on OR ends_on > NEW.ends_on)) OR
 EXISTS (SELECT 1 FROM meetings.sessions WHERE academic_year_id = NEW.id
   AND (starts_at_local::date < NEW.starts_on OR starts_at_local::date >= NEW.ends_on)) THEN
   RAISE EXCEPTION 'Academic year would exclude existing records' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION meetings.check_term_range() RETURNS trigger LANGUAGE plpgsql AS $$
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
   AND (s.academic_year_id <> NEW.academic_year_id OR s.starts_at_local::date < NEW.starts_on OR s.starts_at_local::date >= NEW.ends_on)) THEN
   RAISE EXCEPTION 'Term would exclude or detach existing sessions' USING ERRCODE = '23514';
 END IF;
 RETURN NEW;
END;
$$;
CREATE FUNCTION meetings.set_term(p_actor uuid, p_id uuid, p_year uuid, p_name text, p_start date, p_end date)
RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
 PERFORM people.require_admin(p_actor);
 INSERT INTO meetings.terms(id,academic_year_id,name,starts_on,ends_on) VALUES(p_id,p_year,p_name,p_start,p_end)
 ON CONFLICT(id) DO UPDATE SET academic_year_id=EXCLUDED.academic_year_id,name=EXCLUDED.name,starts_on=EXCLUDED.starts_on,ends_on=EXCLUDED.ends_on;
 INSERT INTO operations.change_history(actor_id,action,entity_id,details)
 VALUES(p_actor,'term.configured',p_id,jsonb_build_object('academicYearId',p_year,'name',p_name,'startsOn',p_start,'endsOn',p_end));
 RETURN p_id;
END;
$$;
CREATE FUNCTION meetings.assign_term(p_actor uuid, p_session uuid, p_term uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 PERFORM people.require_admin(p_actor);
 UPDATE meetings.sessions SET term_id=p_term WHERE id=p_session;
 IF NOT FOUND THEN RAISE EXCEPTION 'Session not found' USING ERRCODE = 'P0002'; END IF;
 INSERT INTO operations.change_history(actor_id,action,entity_id,details)
 VALUES(p_actor,'session.term_assigned',p_session,jsonb_build_object('termId',p_term));
END;
$$;
REVOKE ALL ON FUNCTION meetings.set_term(uuid,uuid,uuid,text,date,date), meetings.assign_term(uuid,uuid,uuid) FROM PUBLIC;

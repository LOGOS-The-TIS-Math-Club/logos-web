-- Monotonic edit tokens avoid timestamp precision loss and stale form overwrites.
ALTER TABLE applications.submissions ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE members.memberships ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE meetings.academic_years ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE meetings.terms ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE meetings.sessions ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE meetings.attendance ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE meetings.absence_notices ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE content.stories ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE content.announcements ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE content.leadership_profiles ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE content.resource_links ADD COLUMN revision integer NOT NULL DEFAULT 1;
ALTER TABLE content.club_info ADD COLUMN revision integer NOT NULL DEFAULT 1;
CREATE INDEX attendance_session ON meetings.attendance(session_id);
CREATE INDEX absence_session ON meetings.absence_notices(session_id);
CREATE INDEX sessions_term ON meetings.sessions(term_id);
CREATE INDEX sessions_year ON meetings.sessions(academic_year_id);
-- Email only reconciles imported, unclaimed identities after trusted Google verification.
-- Ambiguous historical emails are deliberately left for manual reconciliation.
CREATE INDEX identity_email_lookup ON people.identities(lower(email));
-- Views expand * at creation; expose new columns explicitly by rebuilding their projection.
CREATE OR REPLACE VIEW members.current_roster AS
 SELECT m.id,m.identity_id,m.display_name,m.grade,m.grade_academic_year,m.created_at,
 s.status,s.departure_reason,s.starts_on AS state_since,m.updated_at,m.revision
 FROM members.memberships m JOIN members.state_periods s ON s.member_id=m.id
 WHERE s.starts_on <= (now() AT TIME ZONE 'Asia/Tokyo')::date
 AND (s.ends_on IS NULL OR s.ends_on > (now() AT TIME ZONE 'Asia/Tokyo')::date);
CREATE OR REPLACE VIEW members.active_roster AS SELECT * FROM members.current_roster WHERE status='active';
CREATE OR REPLACE VIEW meetings.session_times AS
 SELECT s.id,s.term_id,s.starts_at_local,s.duration_minutes,s.title,s.description,s.location,
 s.materials_folder_url,s.status,s.created_at,
 s.starts_at_local AT TIME ZONE 'Asia/Tokyo' AS starts_at,
 (s.starts_at_local + make_interval(mins=>s.duration_minutes)) AT TIME ZONE 'Asia/Tokyo' AS ends_at,
 s.academic_year_id,s.created_by,s.updated_at,s.revision
 FROM meetings.sessions s;
-- Reacceptance updates an existing member card through the original atomic function.
-- Preserve its edit token even when the caller is an older internal operation.
CREATE FUNCTION members.bump_card_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.revision = OLD.revision THEN NEW.revision := OLD.revision + 1; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER card_revision BEFORE UPDATE ON members.memberships FOR EACH ROW EXECUTE FUNCTION members.bump_card_revision();
REVOKE ALL ON FUNCTION members.bump_card_revision() FROM PUBLIC;
-- Imported links remain recoverable for administrators until their contents/access
-- are reviewed; importing a URL never makes it public automatically.
ALTER TABLE content.resource_links ADD COLUMN published boolean NOT NULL DEFAULT false;

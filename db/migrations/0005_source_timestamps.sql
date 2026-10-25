-- Keep original record times distinct from the time of the import rehearsal.
ALTER TABLE people.identities ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE members.memberships ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE meetings.sessions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN created_by uuid REFERENCES people.identities ON DELETE RESTRICT;
ALTER TABLE meetings.attendance ADD COLUMN recorded_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE meetings.absence_notices ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE content.announcements ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE content.stories ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE content.resource_links ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(), ADD COLUMN created_by uuid REFERENCES people.identities ON DELETE RESTRICT;

CREATE FUNCTION operations.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.updated_at := clock_timestamp();
 RETURN NEW;
END;
$$;
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON people.identities FOR EACH ROW EXECUTE FUNCTION operations.touch_updated_at();
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON members.memberships FOR EACH ROW EXECUTE FUNCTION operations.touch_updated_at();
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON meetings.sessions FOR EACH ROW EXECUTE FUNCTION operations.touch_updated_at();
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON meetings.absence_notices FOR EACH ROW EXECUTE FUNCTION operations.touch_updated_at();
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON content.announcements FOR EACH ROW EXECUTE FUNCTION operations.touch_updated_at();
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON content.stories FOR EACH ROW EXECUTE FUNCTION operations.touch_updated_at();
CREATE TRIGGER touch_updated_at BEFORE UPDATE ON content.resource_links FOR EACH ROW EXECUTE FUNCTION operations.touch_updated_at();
REVOKE ALL ON FUNCTION operations.touch_updated_at() FROM PUBLIC;

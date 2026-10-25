CREATE SCHEMA people;
CREATE SCHEMA applications;
CREATE SCHEMA members;
CREATE SCHEMA meetings;
CREATE SCHEMA content;
CREATE SCHEMA operations;

CREATE TABLE people.identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id text UNIQUE CHECK (length(auth_user_id) BETWEEN 1 AND 255),
  google_subject text UNIQUE CHECK (length(google_subject) BETWEEN 1 AND 255),
  email text NOT NULL CHECK (length(email) BETWEEN 3 AND 320),
  school_verified boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (NOT school_verified OR lower(email) ~ '^[^@[:space:]]+@tokyois\.com$')
);
COMMENT ON COLUMN people.identities.school_verified IS 'Set only from verified provider claims, never from a submitted email address.';

CREATE TABLE people.role_grants (
  identity_id uuid NOT NULL REFERENCES people.identities ON DELETE RESTRICT,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  granted_by uuid REFERENCES people.identities ON DELETE RESTRICT,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (identity_id, role)
);

CREATE TABLE meetings.academic_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  start_year integer NOT NULL UNIQUE CHECK (start_year BETWEEN 1900 AND 2200),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  CHECK (starts_on < ends_on),
  CHECK (starts_on = make_date(start_year, 8, 1)),
  CHECK (ends_on = make_date(start_year + 1, 8, 1))
);
CREATE TABLE meetings.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year_id uuid NOT NULL REFERENCES meetings.academic_years ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  CHECK (starts_on < ends_on),
  UNIQUE (academic_year_id, name)
);

CREATE TABLE members.memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL UNIQUE REFERENCES people.identities ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 80),
  grade integer NOT NULL CHECK (grade BETWEEN 9 AND 12),
  grade_academic_year integer NOT NULL REFERENCES meetings.academic_years(start_year) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE members.private_notes (
  member_id uuid PRIMARY KEY REFERENCES members.memberships ON DELETE RESTRICT,
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 4000)
);
CREATE TABLE members.state_changes (
  member_id uuid NOT NULL REFERENCES members.memberships ON DELETE RESTRICT,
  effective_on date NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'paused', 'former')),
  departure_reason text CHECK (departure_reason IN ('graduated', 'quit', 'removed')),
  recorded_by uuid NOT NULL REFERENCES people.identities ON DELETE RESTRICT,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, effective_on),
  CHECK ((status = 'former') = (departure_reason IS NOT NULL))
);
CREATE VIEW members.state_periods AS
 SELECT member_id, effective_on AS starts_on,
   lead(effective_on) OVER (PARTITION BY member_id ORDER BY effective_on) AS ends_on,
   status, departure_reason
 FROM members.state_changes;
CREATE VIEW members.current_roster AS
 SELECT m.*, s.status, s.departure_reason, s.starts_on AS state_since
 FROM members.memberships m
 JOIN members.state_periods s ON s.member_id = m.id
 WHERE s.starts_on <= (now() AT TIME ZONE 'Asia/Tokyo')::date
 AND (s.ends_on IS NULL OR s.ends_on > (now() AT TIME ZONE 'Asia/Tokyo')::date);
CREATE VIEW members.active_roster AS SELECT * FROM members.current_roster WHERE status = 'active';

CREATE TABLE applications.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL REFERENCES people.identities ON DELETE RESTRICT,
  preferred_name text NOT NULL CHECK (length(btrim(preferred_name)) BETWEEN 1 AND 80),
  grade integer NOT NULL CHECK (grade BETWEEN 9 AND 12),
  grade_academic_year integer NOT NULL REFERENCES meetings.academic_years(start_year) ON DELETE RESTRICT,
  academic_interests text[] NOT NULL CHECK (cardinality(academic_interests) BETWEEN 1 AND 8 AND academic_interests <@ ARRAY['problem_solving','algebra','geometry','number_theory','combinatorics','logic_puzzles','applied_math','other']::text[] AND array_position(academic_interests, NULL) IS NULL),
  join_reason text NOT NULL CHECK (length(btrim(join_reason)) BETWEEN 30 AND 500),
  goals text NOT NULL CHECK (length(btrim(goals)) BETWEEN 30 AND 500),
  experience text CHECK (length(experience) <= 500),
  math_course text CHECK (math_course IN ('myp_standard','myp_extended','dp_aa_sl','dp_aa_hl','dp_ai_sl','dp_ai_hl','other')),
  contest_interest text CHECK (contest_interest IN ('yes','maybe','no')),
  present_interest text CHECK (present_interest IN ('yes','maybe','no')),
  attendance_confirmation text NOT NULL CHECK (attendance_confirmation IN ('regular','occasional_conflicts','conflict')),
  accuracy_acknowledged boolean NOT NULL CHECK (accuracy_acknowledged),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','under_review','accepted','rejected','withdrawn')),
  member_id uuid REFERENCES members.memberships ON DELETE RESTRICT,
  status_reason text CHECK (length(status_reason) <= 256),
  reviewed_by uuid REFERENCES people.identities ON DELETE RESTRICT,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  status_updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((status = 'accepted') = (member_id IS NOT NULL))
);
CREATE UNIQUE INDEX one_open_application ON applications.submissions(identity_id) WHERE status IN ('submitted','under_review');
CREATE INDEX application_review_queue ON applications.submissions(status, submitted_at);
CREATE TABLE applications.reapplication_restrictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id uuid NOT NULL REFERENCES people.identities ON DELETE RESTRICT,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  recorded_by uuid NOT NULL REFERENCES people.identities ON DELETE RESTRICT,
  CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX restriction_identity ON applications.reapplication_restrictions(identity_id);

CREATE TABLE meetings.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id uuid NOT NULL REFERENCES meetings.terms ON DELETE RESTRICT,
  starts_at_local timestamp without time zone NOT NULL,
  duration_minutes integer NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  location text CHECK (length(location) <= 100),
  materials_folder_url text CHECK (materials_folder_url ~ '^https://drive\.google\.com/drive/(u/[0-9]+/)?folders/[A-Za-z0-9_-]+(\?[^[:space:]]*)?$'),
  CHECK (materials_folder_url IS NULL OR length(materials_folder_url) <= 2048),
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_start ON meetings.sessions(starts_at_local);
CREATE VIEW meetings.session_times AS
 SELECT s.*, starts_at_local AT TIME ZONE 'Asia/Tokyo' AS starts_at,
 (starts_at_local + make_interval(mins => duration_minutes)) AT TIME ZONE 'Asia/Tokyo' AS ends_at
 FROM meetings.sessions s;
CREATE TABLE meetings.attendance (
  member_id uuid NOT NULL REFERENCES members.memberships ON DELETE RESTRICT,
  session_id uuid NOT NULL REFERENCES meetings.sessions ON DELETE RESTRICT,
  status text NOT NULL CHECK (status IN ('unmarked','present','late','excused_absence','unexcused_absence')),
  notes text CHECK (length(notes) <= 256),
  recorded_by uuid NOT NULL REFERENCES people.identities ON DELETE RESTRICT,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, session_id)
);
CREATE TABLE meetings.absence_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members.memberships ON DELETE RESTRICT,
  session_id uuid REFERENCES meetings.sessions ON DELETE RESTRICT,
  session_date date,
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 1 AND 500),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted','acknowledged','cancelled')),
  submitted_by uuid NOT NULL REFERENCES people.identities ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((session_id IS NULL) = (session_date IS NOT NULL))
);
CREATE UNIQUE INDEX one_live_notice_per_session ON meetings.absence_notices(member_id, session_id) WHERE status <> 'cancelled' AND session_id IS NOT NULL;

CREATE TABLE operations.change_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES people.identities ON DELETE RESTRICT,
  action text NOT NULL,
  entity_id uuid NOT NULL,
  details jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(details) = 'object' AND pg_column_size(details) <= 4096),
  recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX history_entity ON operations.change_history(entity_id, recorded_at);

CREATE TABLE content.images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/webp','image/gif')),
  data bytea NOT NULL CHECK (octet_length(data) BETWEEN 1 AND 2097152),
  alt_text text NOT NULL CHECK (length(btrim(alt_text)) BETWEEN 1 AND 300),
  width integer CHECK (width > 0), height integer CHECK (height > 0),
  uploaded_by uuid REFERENCES people.identities ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE content.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  image_id uuid REFERENCES content.images ON DELETE RESTRICT,
  published_at timestamptz,
  created_by uuid REFERENCES people.identities ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE content.stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  occurred_on date NOT NULL,
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 4000),
  image_id uuid REFERENCES content.images ON DELETE RESTRICT,
  published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES people.identities ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE content.leadership_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members.memberships ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 80),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  biography text NOT NULL DEFAULT '' CHECK (length(biography) <= 4000),
  image_id uuid REFERENCES content.images ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT false
);
CREATE TABLE content.resource_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 280),
  url text NOT NULL CHECK (url ~ '^https://[^[:space:]]+$' AND length(url) <= 2048),
  sort_order integer NOT NULL DEFAULT 0
);
CREATE TABLE content.club_info (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  about text NOT NULL DEFAULT '' CHECK (length(about) <= 10000),
  semester_focus text NOT NULL DEFAULT '' CHECK (length(semester_focus) <= 4000),
  contact_email text NOT NULL DEFAULT 'mathclub@tokyois.com' CHECK (length(contact_email) BETWEEN 3 AND 320)
);

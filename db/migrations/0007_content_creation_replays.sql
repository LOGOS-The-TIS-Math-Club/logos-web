-- One durable receipt per logical content save. No image bytes or provider data.
CREATE TABLE operations.content_creations (
  actor_id uuid NOT NULL REFERENCES people.identities ON DELETE RESTRICT,
  operation text NOT NULL CHECK (operation IN ('story','announcement','leadership','resource','club_info','image')),
  request_id uuid NOT NULL,
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (actor_id, operation, request_id)
);
REVOKE ALL ON operations.content_creations FROM PUBLIC;

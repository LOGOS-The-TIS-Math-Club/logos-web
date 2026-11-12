CREATE TABLE content.post_images (
  story_id uuid REFERENCES content.stories(id) ON DELETE CASCADE,
  announcement_id uuid REFERENCES content.announcements(id) ON DELETE CASCADE,
  image_id uuid NOT NULL REFERENCES content.images(id) ON DELETE RESTRICT,
  position integer NOT NULL CHECK (position >= 0),
  CHECK (num_nonnulls(story_id, announcement_id) = 1),
  UNIQUE (story_id, position),
  UNIQUE (announcement_id, position)
);
CREATE INDEX post_images_image_id ON content.post_images(image_id);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'logos_runtime') THEN
    GRANT SELECT, INSERT, DELETE ON content.post_images TO logos_runtime;
  END IF;
END
$$;

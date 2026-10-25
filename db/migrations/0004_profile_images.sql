-- Retain backed-up profile images without retaining a dependency on hosted Auth URLs.
ALTER TABLE people.identities ADD COLUMN profile_image_id uuid REFERENCES content.images ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE "logos"."images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mime_type" text NOT NULL,
	"byte_size" integer NOT NULL,
	"alt_text" text NOT NULL,
	"data" "bytea" NOT NULL,
	"uploaded_by_identity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "images_mime_type_check" CHECK ("mime_type" IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
	CONSTRAINT "images_byte_size_check" CHECK ("byte_size" > 0 AND "byte_size" <= 2097152),
	CONSTRAINT "images_alt_text_len_check" CHECK (char_length("alt_text") BETWEEN 1 AND 300)
);
--> statement-breakpoint
CREATE TABLE "logos"."story_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"image_id" uuid,
	"occurred_on" date NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_by_identity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "story_entries_title_len_check" CHECK (char_length("title") BETWEEN 1 AND 120),
	CONSTRAINT "story_entries_body_len_check" CHECK (char_length("body") BETWEEN 1 AND 4000)
);
--> statement-breakpoint
ALTER TABLE "logos"."announcements" ADD COLUMN "image_id" uuid;--> statement-breakpoint
ALTER TABLE "logos"."images" ADD CONSTRAINT "images_uploaded_by_identity_id_application_identities_id_fk" FOREIGN KEY ("uploaded_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."story_entries" ADD CONSTRAINT "story_entries_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "logos"."images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."story_entries" ADD CONSTRAINT "story_entries_created_by_identity_id_application_identities_id_fk" FOREIGN KEY ("created_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "story_entries_published_idx" ON "logos"."story_entries" USING btree ("published","occurred_on");--> statement-breakpoint
ALTER TABLE "logos"."announcements" ADD CONSTRAINT "announcements_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "logos"."images"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Default privileges from 0000 should already cover tables created by the
-- migration role, but every table-adding migration in this project grants
-- explicitly rather than relying on that. A silent permission failure here
-- would only surface as a broken image on the public home page.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE logos.images TO logos_runtime;--> statement-breakpoint
GRANT SELECT ON TABLE logos.images TO logos_backup;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE logos.story_entries TO logos_runtime;--> statement-breakpoint
GRANT SELECT ON TABLE logos.story_entries TO logos_backup;

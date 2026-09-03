CREATE TABLE "logos"."announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_by_identity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "announcements_title_len_check" CHECK (char_length("title") BETWEEN 1 AND 120),
	CONSTRAINT "announcements_body_len_check" CHECK (char_length("body") BETWEEN 1 AND 2000),
	CONSTRAINT "announcements_published_at_check" CHECK (("published" = false AND "published_at" IS NULL) OR ("published" = true AND "published_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "logos"."announcements" ADD CONSTRAINT "announcements_created_by_identity_id_application_identities_id_fk" FOREIGN KEY ("created_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_published_idx" ON "logos"."announcements" USING btree ("published","published_at");--> statement-breakpoint
-- Default privileges from 0000 should already cover a table created by the
-- migration role, but every table-adding migration in this project grants
-- explicitly rather than relying on that. A silent permission failure here
-- would only surface as a runtime error on the public page.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE logos.announcements TO logos_runtime;--> statement-breakpoint
GRANT SELECT ON TABLE logos.announcements TO logos_backup;

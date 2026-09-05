CREATE TABLE "logos"."club_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_by_identity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "club_resources_title_len_check" CHECK (char_length("title") BETWEEN 1 AND 80),
	CONSTRAINT "club_resources_description_len_check" CHECK (char_length("description") BETWEEN 1 AND 280),
	CONSTRAINT "club_resources_url_check" CHECK ("url" LIKE 'https://%' AND char_length("url") BETWEEN 12 AND 2048)
);
--> statement-breakpoint
ALTER TABLE "logos"."club_sessions" ADD COLUMN "drive_folder_id" text;--> statement-breakpoint
ALTER TABLE "logos"."club_resources" ADD CONSTRAINT "club_resources_created_by_identity_id_application_identities_id_fk" FOREIGN KEY ("created_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_resources_order_idx" ON "logos"."club_resources" USING btree ("sort_order","title");--> statement-breakpoint
ALTER TABLE "logos"."club_sessions" ADD CONSTRAINT "club_sessions_drive_folder_len_check" CHECK ("drive_folder_id" IS NULL OR char_length("drive_folder_id") BETWEEN 1 AND 128);--> statement-breakpoint
-- Default privileges from 0000 should already cover a table created by the
-- migration role, but every table-adding migration in this project grants
-- explicitly rather than relying on that. A silent permission failure here
-- would only surface as a runtime error on the member dashboard.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE logos.club_resources TO logos_runtime;--> statement-breakpoint
GRANT SELECT ON TABLE logos.club_resources TO logos_backup;

ALTER TABLE "logos"."club_members" ADD COLUMN "display_name" text;--> statement-breakpoint
ALTER TABLE "logos"."club_members" ADD COLUMN "roster_name" text;--> statement-breakpoint
ALTER TABLE "logos"."club_members" ADD CONSTRAINT "club_members_display_name_len_check" CHECK ("display_name" IS NULL OR char_length("display_name") BETWEEN 1 AND 80);--> statement-breakpoint
ALTER TABLE "logos"."club_members" ADD CONSTRAINT "club_members_roster_name_len_check" CHECK ("roster_name" IS NULL OR char_length("roster_name") BETWEEN 1 AND 80);
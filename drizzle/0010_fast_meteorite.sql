ALTER TABLE "logos"."club_members" ADD COLUMN "cohort_year" integer;--> statement-breakpoint
ALTER TABLE "logos"."club_members" ADD COLUMN "grade_override" text;--> statement-breakpoint
ALTER TABLE "logos"."club_members" ADD CONSTRAINT "club_members_cohort_year_check" CHECK ("cohort_year" IS NULL OR "cohort_year" BETWEEN 2000 AND 2100);--> statement-breakpoint
ALTER TABLE "logos"."club_members" ADD CONSTRAINT "club_members_grade_override_len_check" CHECK ("grade_override" IS NULL OR char_length("grade_override") BETWEEN 1 AND 40);
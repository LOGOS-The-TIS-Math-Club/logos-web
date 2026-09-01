CREATE TYPE "logos"."student_application_status" AS ENUM('submitted', 'reviewing', 'accepted', 'declined');--> statement-breakpoint
CREATE TABLE "logos"."student_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"preferred_name" text NOT NULL,
	"grade" text NOT NULL,
	"academic_interests" jsonb NOT NULL,
	"join_reason" text NOT NULL,
	"goals" text NOT NULL,
	"experience" text,
	"attendance_confirmation" text NOT NULL,
	"accuracy_acknowledged" boolean DEFAULT true NOT NULL,
	"status" "logos"."student_application_status" DEFAULT 'submitted' NOT NULL,
	"status_reason" text,
	"reviewed_by_identity_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"status_updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "student_applications_preferred_name_len_check" CHECK (char_length("preferred_name") BETWEEN 1 AND 80),
	CONSTRAINT "student_applications_grade_check" CHECK ("grade" IN ('Grade 9', 'Grade 10', 'Grade 11', 'Grade 12')),
	CONSTRAINT "student_applications_academic_interests_check" CHECK (jsonb_typeof("academic_interests") = 'array' AND jsonb_array_length("academic_interests") BETWEEN 1 AND 8),
	CONSTRAINT "student_applications_join_reason_len_check" CHECK (char_length("join_reason") BETWEEN 30 AND 500),
	CONSTRAINT "student_applications_goals_len_check" CHECK (char_length("goals") BETWEEN 30 AND 500),
	CONSTRAINT "student_applications_experience_len_check" CHECK ("experience" IS NULL OR char_length("experience") <= 500),
	CONSTRAINT "student_applications_attendance_check" CHECK ("attendance_confirmation" IN ('regular', 'occasional_conflicts', 'conflict')),
	CONSTRAINT "student_applications_status_reason_len_check" CHECK ("status_reason" IS NULL OR char_length("status_reason") <= 256),
	CONSTRAINT "student_applications_acknowledged_check" CHECK ("accuracy_acknowledged" = true)
);
--> statement-breakpoint
ALTER TABLE "logos"."student_applications" ADD CONSTRAINT "student_applications_identity_id_application_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."student_applications" ADD CONSTRAINT "student_applications_reviewed_by_identity_id_application_identities_id_fk" FOREIGN KEY ("reviewed_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "student_applications_identity_idx" ON "logos"."student_applications" USING btree ("identity_id");--> statement-breakpoint
CREATE INDEX "student_applications_status_submitted_idx" ON "logos"."student_applications" USING btree ("status","submitted_at");
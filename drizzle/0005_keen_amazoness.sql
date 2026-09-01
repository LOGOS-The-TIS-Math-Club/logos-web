CREATE TYPE "logos"."attendance_status" AS ENUM('unmarked', 'present', 'late', 'excused_absence', 'unexcused_absence');--> statement-breakpoint
CREATE TYPE "logos"."club_member_status" AS ENUM('active', 'inactive', 'former');--> statement-breakpoint
CREATE TYPE "logos"."expected_absence_status" AS ENUM('submitted', 'acknowledged', 'cancelled');--> statement-breakpoint
CREATE TABLE "logos"."club_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identity_id" uuid NOT NULL,
	"application_id" uuid,
	"status" "logos"."club_member_status" DEFAULT 'active' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"left_at" timestamp with time zone,
	"status_reason" text,
	"created_by_identity_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "club_members_status_reason_len_check" CHECK ("status_reason" IS NULL OR char_length("status_reason") <= 256),
	CONSTRAINT "club_members_left_at_check" CHECK (("status" = 'active' AND "left_at" IS NULL) OR ("status" IN ('inactive', 'former') AND "left_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "logos"."club_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'LOGOS Weekly Meeting' NOT NULL,
	"session_date" date NOT NULL,
	"start_time" text DEFAULT '15:30' NOT NULL,
	"end_time" text DEFAULT '16:30' NOT NULL,
	"location" text DEFAULT 'Room 101' NOT NULL,
	"notes" text,
	"created_by_identity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "club_sessions_title_len_check" CHECK (char_length("title") BETWEEN 1 AND 120),
	CONSTRAINT "club_sessions_start_time_len_check" CHECK (char_length("start_time") BETWEEN 1 AND 10),
	CONSTRAINT "club_sessions_end_time_len_check" CHECK (char_length("end_time") BETWEEN 1 AND 10),
	CONSTRAINT "club_sessions_location_len_check" CHECK (char_length("location") BETWEEN 1 AND 100),
	CONSTRAINT "club_sessions_notes_len_check" CHECK ("notes" IS NULL OR char_length("notes") <= 500)
);
--> statement-breakpoint
CREATE TABLE "logos"."expected_absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"session_id" uuid,
	"session_date" date NOT NULL,
	"reason" text NOT NULL,
	"status" "logos"."expected_absence_status" DEFAULT 'submitted' NOT NULL,
	"submitted_by_identity_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "expected_absences_reason_len_check" CHECK (char_length("reason") BETWEEN 1 AND 500)
);
--> statement-breakpoint
CREATE TABLE "logos"."member_warnings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"issued_by_identity_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"issued_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by_identity_id" uuid,
	CONSTRAINT "member_warnings_reason_len_check" CHECK (char_length("reason") BETWEEN 1 AND 256),
	CONSTRAINT "member_warnings_notes_len_check" CHECK ("notes" IS NULL OR char_length("notes") <= 500),
	CONSTRAINT "member_warnings_resolution_check" CHECK (("active" AND "resolved_at" IS NULL AND "resolved_by_identity_id" IS NULL) OR (NOT "active" AND "resolved_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "logos"."session_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"status" "logos"."attendance_status" DEFAULT 'unmarked' NOT NULL,
	"notes" text,
	"recorded_by_identity_id" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT clock_timestamp() NOT NULL,
	CONSTRAINT "session_attendance_notes_len_check" CHECK ("notes" IS NULL OR char_length("notes") <= 256)
);
--> statement-breakpoint
ALTER TABLE "logos"."club_members" ADD CONSTRAINT "club_members_identity_id_application_identities_id_fk" FOREIGN KEY ("identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."club_members" ADD CONSTRAINT "club_members_application_id_student_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "logos"."student_applications"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."club_members" ADD CONSTRAINT "club_members_created_by_identity_id_application_identities_id_fk" FOREIGN KEY ("created_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."club_sessions" ADD CONSTRAINT "club_sessions_created_by_identity_id_application_identities_id_fk" FOREIGN KEY ("created_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."expected_absences" ADD CONSTRAINT "expected_absences_member_id_club_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "logos"."club_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."expected_absences" ADD CONSTRAINT "expected_absences_session_id_club_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "logos"."club_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."expected_absences" ADD CONSTRAINT "expected_absences_submitted_by_identity_id_application_identities_id_fk" FOREIGN KEY ("submitted_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."member_warnings" ADD CONSTRAINT "member_warnings_member_id_club_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "logos"."club_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."member_warnings" ADD CONSTRAINT "member_warnings_issued_by_identity_id_application_identities_id_fk" FOREIGN KEY ("issued_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."member_warnings" ADD CONSTRAINT "member_warnings_resolved_by_identity_id_application_identities_id_fk" FOREIGN KEY ("resolved_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."session_attendance" ADD CONSTRAINT "session_attendance_session_id_club_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "logos"."club_sessions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."session_attendance" ADD CONSTRAINT "session_attendance_member_id_club_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "logos"."club_members"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logos"."session_attendance" ADD CONSTRAINT "session_attendance_recorded_by_identity_id_application_identities_id_fk" FOREIGN KEY ("recorded_by_identity_id") REFERENCES "logos"."application_identities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "club_members_identity_active_idx" ON "logos"."club_members" USING btree ("identity_id") WHERE "status" = 'active';--> statement-breakpoint
CREATE INDEX "club_members_status_joined_idx" ON "logos"."club_members" USING btree ("status","joined_at");--> statement-breakpoint
CREATE INDEX "club_members_application_idx" ON "logos"."club_members" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "club_sessions_date_idx" ON "logos"."club_sessions" USING btree ("session_date");--> statement-breakpoint
CREATE INDEX "expected_absences_member_date_idx" ON "logos"."expected_absences" USING btree ("member_id","session_date");--> statement-breakpoint
CREATE INDEX "expected_absences_session_idx" ON "logos"."expected_absences" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "member_warnings_member_active_idx" ON "logos"."member_warnings" USING btree ("member_id","active");--> statement-breakpoint
CREATE UNIQUE INDEX "session_attendance_session_member_idx" ON "logos"."session_attendance" USING btree ("session_id","member_id");--> statement-breakpoint
CREATE INDEX "session_attendance_member_idx" ON "logos"."session_attendance" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "session_attendance_session_idx" ON "logos"."session_attendance" USING btree ("session_id");
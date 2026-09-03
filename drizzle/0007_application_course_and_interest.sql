ALTER TABLE "logos"."student_applications" ADD COLUMN "math_course" text;--> statement-breakpoint
ALTER TABLE "logos"."student_applications" ADD COLUMN "contest_interest" text;--> statement-breakpoint
ALTER TABLE "logos"."student_applications" ADD COLUMN "present_interest" text;--> statement-breakpoint
ALTER TABLE "logos"."student_applications" ADD CONSTRAINT "student_applications_math_course_check" CHECK ("math_course" IS NULL OR "math_course" IN ('myp_standard', 'myp_extended', 'dp_aa_sl', 'dp_aa_hl', 'dp_ai_sl', 'dp_ai_hl', 'other', 'prefer_not_to_say'));--> statement-breakpoint
ALTER TABLE "logos"."student_applications" ADD CONSTRAINT "student_applications_contest_interest_check" CHECK ("contest_interest" IS NULL OR "contest_interest" IN ('yes', 'maybe', 'no'));--> statement-breakpoint
ALTER TABLE "logos"."student_applications" ADD CONSTRAINT "student_applications_present_interest_check" CHECK ("present_interest" IS NULL OR "present_interest" IN ('yes', 'maybe', 'no'));
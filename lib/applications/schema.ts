import { z } from "zod";

export const GRADES = ["Grade 9", "Grade 10", "Grade 11", "Grade 12"] as const;
export type Grade = (typeof GRADES)[number];

export const MATHEMATICAL_INTERESTS = [
  { key: "problem_solving", label: "Problem solving & Olympiad math" },
  { key: "algebra", label: "Algebra & polynomials" },
  { key: "geometry", label: "Geometry & trigonometry" },
  { key: "number_theory", label: "Number theory & cryptography" },
  { key: "combinatorics", label: "Combinatorics & discrete math" },
  { key: "logic_puzzles", label: "Logic, games & puzzles" },
  { key: "applied_math", label: "Applied mathematics & modeling" },
  { key: "other", label: "Not sure yet — exploring" },
] as const;

export const INTEREST_KEYS = MATHEMATICAL_INTERESTS.map((item) => item.key);
export type InterestKey = (typeof INTEREST_KEYS)[number];

/*
 * Course level. Optional on purpose: it helps pitch a session at the right
 * level, but a student may not want to share it, so "Prefer not to say" is a
 * first-class answer rather than a blank.
 *
 * Options follow the IB pathway the school runs — MYP in Grades 9–10, DP in
 * Grades 11–12.
 */
export const MATH_COURSES = [
  { key: "myp_standard", label: "MYP Mathematics (Standard)" },
  { key: "myp_extended", label: "MYP Mathematics (Extended)" },
  { key: "dp_aa_sl", label: "DP Analysis & Approaches SL" },
  { key: "dp_aa_hl", label: "DP Analysis & Approaches HL" },
  { key: "dp_ai_sl", label: "DP Applications & Interpretation SL" },
  { key: "dp_ai_hl", label: "DP Applications & Interpretation HL" },
  { key: "other", label: "Something else" },
  { key: "prefer_not_to_say", label: "Prefer not to say" },
] as const;

export const MATH_COURSE_KEYS = MATH_COURSES.map((item) => item.key);

/** Shared yes / maybe / no scale. "Not sure" is always an honest answer. */
export const INTEREST_SCALE_KEYS = ["yes", "maybe", "no"] as const;

export const CONTEST_INTEREST_OPTIONS = [
  { key: "yes", label: "Yes, I'd like to take part." },
  { key: "maybe", label: "Maybe — I'd like to see one first." },
  { key: "no", label: "No, I'd rather just do the sessions." },
] as const;

export const PRESENT_INTEREST_OPTIONS = [
  { key: "yes", label: "Yes, I'd like to present something." },
  { key: "maybe", label: "Maybe, with some help preparing." },
  { key: "no", label: "No, I'd prefer not to." },
] as const;

export const ATTENDANCE_KEYS = [
  "regular",
  "occasional_conflicts",
  "conflict",
] as const;
export const ATTENDANCE_OPTIONS = [
  { key: "regular", label: "Yes, I can attend regularly." },
  {
    key: "occasional_conflicts",
    label: "Usually, but I may have occasional conflicts.",
  },
  {
    key: "conflict",
    label: "No, I have an ongoing scheduling conflict.",
  },
] as const;
export type AttendanceOption = (typeof ATTENDANCE_OPTIONS)[number]["key"];

export const APPLICATION_STATUSES = [
  "submitted",
  "reviewing",
  "accepted",
  "declined",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const StudentApplicationInputSchema = z.object({
  preferredName: z
    .string()
    .trim()
    .min(1, "Preferred name must not be blank")
    .max(80, "Preferred name must not exceed 80 characters"),
  grade: z.enum(GRADES),
  academicInterests: z
    .array(z.string())
    .min(1, "Please select at least one mathematical interest")
    .max(8, "You may select up to 8 interests")
    .refine(
      (items) =>
        items.every((item) =>
          (INTEREST_KEYS as readonly string[]).includes(item),
        ),
      { message: "One or more selected interests are invalid" },
    ),
  joinReason: z
    .string()
    .trim()
    .min(
      30,
      "Please provide at least 30 characters explaining why you would like to join",
    )
    .max(500, "Reason for joining must not exceed 500 characters"),
  goals: z
    .string()
    .trim()
    .min(
      30,
      "Please provide at least 30 characters describing what you would like to learn or contribute",
    )
    .max(500, "Learning or contribution goal must not exceed 500 characters"),
  experience: z
    .string()
    .trim()
    .max(500, "Background experience must not exceed 500 characters")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  /*
   * Optional, and stored as null when skipped or when the student chooses
   * "Prefer not to say" — we keep the fact they declined out of the record
   * rather than storing a refusal as data about them.
   */
  mathCourse: z
    .enum(MATH_COURSE_KEYS as [string, ...string[]])
    .optional()
    .nullable()
    .transform((val) => (val && val !== "prefer_not_to_say" ? val : null)),
  contestInterest: z.enum(INTEREST_SCALE_KEYS),
  presentInterest: z.enum(INTEREST_SCALE_KEYS),
  attendanceConfirmation: z.enum(ATTENDANCE_KEYS),
  accuracyAcknowledged: z.literal(true),
});

export type StudentApplicationInput = z.infer<
  typeof StudentApplicationInputSchema
>;

export const ApplicationStatusUpdateSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
  statusReason: z
    .string()
    .trim()
    .max(256, "Status reason must not exceed 256 characters")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
});

export type ApplicationStatusUpdate = z.infer<
  typeof ApplicationStatusUpdateSchema
>;

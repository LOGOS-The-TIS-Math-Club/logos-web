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
  { key: "other", label: "Other / exploring" },
] as const;

export const INTEREST_KEYS = MATHEMATICAL_INTERESTS.map((item) => item.key);
export type InterestKey = (typeof INTEREST_KEYS)[number];

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

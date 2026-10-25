import { z } from "zod";

export const applicationInput = z.object({
  preferredName: z.string().trim().min(1).max(80),
  grade: z.number().int().min(9).max(12),
  gradeAcademicYear: z.number().int().min(1900).max(2200),
  academicInterests: z
    .array(
      z.enum([
        "problem_solving",
        "algebra",
        "geometry",
        "number_theory",
        "combinatorics",
        "logic_puzzles",
        "applied_math",
        "other",
      ]),
    )
    .min(1)
    .max(8)
    .refine((v) => new Set(v).size === v.length, "Choose each interest once"),
  joinReason: z.string().trim().min(30).max(500),
  goals: z.string().trim().min(30).max(500),
  experience: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => v || null),
  mathCourse: z
    .enum([
      "myp_standard",
      "myp_extended",
      "dp_aa_sl",
      "dp_aa_hl",
      "dp_ai_sl",
      "dp_ai_hl",
      "other",
      "prefer_not_to_say",
    ])
    .nullish()
    .transform((v) => (v === "prefer_not_to_say" || !v ? null : v)),
  contestInterest: z.enum(["yes", "maybe", "no"]),
  presentInterest: z.enum(["yes", "maybe", "no"]),
  attendanceConfirmation: z.enum([
    "regular",
    "occasional_conflicts",
    "conflict",
  ]),
  accuracyAcknowledged: z.literal(true),
});
export const memberCardInput = z.object({
  displayName: z.string().trim().min(1).max(80),
  grade: z.number().int().min(9).max(12),
  gradeAcademicYear: z.number().int().min(1900).max(2200),
  startsOn: z.iso.date(),
  privateNotes: z.string().trim().max(4000).default(""),
});

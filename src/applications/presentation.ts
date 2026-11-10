export const interests = [
  ["problem_solving", "Problem solving & Olympiad math"],
  ["algebra", "Algebra & polynomials"],
  ["geometry", "Geometry & trigonometry"],
  ["number_theory", "Number theory & cryptography"],
  ["combinatorics", "Combinatorics & discrete math"],
  ["logic_puzzles", "Logic, games & puzzles"],
  ["applied_math", "Applied mathematics & modeling"],
  ["other", "Not sure yet. Exploring"],
] as const;
export const courses = [
  ["myp_standard", "MYP Mathematics (Standard)"],
  ["myp_extended", "MYP Mathematics (Extended)"],
  ["dp_aa_sl", "DP Analysis & Approaches SL"],
  ["dp_aa_hl", "DP Analysis & Approaches HL"],
  ["dp_ai_sl", "DP Applications & Interpretation SL"],
  ["dp_ai_hl", "DP Applications & Interpretation HL"],
  ["other", "Something else"],
  ["prefer_not_to_say", "Prefer not to say"],
] as const;
export const contestOptions = [
  ["yes", "Yes, I'd like to take part."],
  ["maybe", "Maybe, I'd like to see one first."],
  ["no", "No, I'd rather just do the sessions."],
] as const;
export const presentOptions = [
  ["yes", "Yes, I'd like to present something."],
  ["maybe", "Maybe, with some help preparing."],
  ["no", "No, I'd prefer not to."],
] as const;
export const attendanceOptions = [
  ["regular", "Yes, I can attend regularly."],
  ["occasional_conflicts", "Usually, but I may have occasional conflicts."],
  ["conflict", "No, I have an ongoing scheduling conflict."],
] as const;
export const statusLabels = {
  submitted: "Submitted",
  under_review: "Under review",
  accepted: "Accepted",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
} as const;
export type ApplicationStatus = keyof typeof statusLabels;
export function optionLabel(
  options: readonly (readonly [string, string])[],
  value: string | null,
) {
  return options.find(([key]) => key === value)?.[1] ?? "Not provided";
}

export interface OwnApplication {
  id: string;
  preferred_name: string;
  grade: number;
  grade_academic_year: number;
  academic_interests: string[];
  join_reason: string;
  goals: string;
  experience: string | null;
  math_course: string | null;
  contest_interest: string | null;
  present_interest: string | null;
  attendance_confirmation: string;
  accuracy_acknowledged: boolean;
  status: ApplicationStatus;
  submitted_at: string;
  status_updated_at: string;
  revision: number;
  canWithdraw: boolean;
}
export interface ApplicationEntry {
  identityId: string;
  email: string;
  academicYear: { startYear: number; name: string } | null;
  blockedBy:
    "identity" | "restricted" | "current_member" | "open_application" | null;
  applications: OwnApplication[];
}
export type ApplyState =
  | { status: "ready"; entry: ApplicationEntry }
  | { status: "anonymous" | "denied" | "unconfigured" | "unavailable" };

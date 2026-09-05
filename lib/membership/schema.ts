import { z } from "zod";

export const CLUB_MEMBER_STATUSES = ["active", "inactive", "former"] as const;
export type ClubMemberStatus = (typeof CLUB_MEMBER_STATUSES)[number];

export const ActivateMemberInputSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  reason: z
    .string()
    .max(256, "Reason must not exceed 256 characters")
    .optional(),
});
export type ActivateMemberInput = z.infer<typeof ActivateMemberInputSchema>;

export const UpdateMemberStatusSchema = z.object({
  status: z.enum(CLUB_MEMBER_STATUSES),
  reason: z
    .string()
    .max(256, "Reason must not exceed 256 characters")
    .optional(),
});
export type UpdateMemberStatusInput = z.infer<typeof UpdateMemberStatusSchema>;

export interface MemberListItem {
  id: string;
  identityId: string;
  applicationId: string | null;
  preferredName: string;
  /** What leadership sees: the operator-set name, else the application name. */
  rosterName: string;
  /** What the member calls themselves, or null if they have not set one. */
  displayName: string | null;
  /** The grade as applied, before any progression or override. */
  appliedGrade: string | null;
  cohortYear: number | null;
  gradeOverride: string | null;
  email: string;
  grade: string | null;
  status: ClubMemberStatus;
  joinedAt: string;
  leftAt: string | null;
  statusReason: string | null;
  warningCount: number;
}

/*
 * Both names share one shape but not one schema, because they are set by
 * different people for different audiences and are validated at their own
 * boundaries.
 */
const nameField = z
  .string()
  .trim()
  .min(1, "Name is required")
  .max(80, "Name must not exceed 80 characters");

/** A member renaming themselves. */
export const UpdateDisplayNameSchema = z.object({ displayName: nameField });
export type UpdateDisplayNameInput = z.infer<typeof UpdateDisplayNameSchema>;

/**
 * Leadership editing a member's metadata.
 *
 * Every field is nullable and every field is optional, and those mean different
 * things: an absent key leaves the value alone, an explicit null clears the
 * override so the value falls back to what was derived or applied for. A form
 * that could only set and never clear would leave a mistyped override stuck
 * forever.
 *
 * Written out longhand rather than derived with .partial(), for the same reason
 * as the session and resource schemas: Zod applies a field's .default() even
 * through .partial().
 */
export const UpdateMemberMetadataSchema = z
  .object({
    rosterName: nameField.nullable(),
    /** Overrides derived grade progression outright when set. */
    gradeOverride: z
      .string()
      .trim()
      .min(1)
      .max(40, "Grade must not exceed 40 characters")
      .nullable(),
    /** The school year the member held the grade they applied as. */
    cohortYear: z
      .number()
      .int()
      .min(2000, "Cohort year looks wrong")
      .max(2100, "Cohort year looks wrong")
      .nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });
export type UpdateMemberMetadataInput = z.infer<
  typeof UpdateMemberMetadataSchema
>;

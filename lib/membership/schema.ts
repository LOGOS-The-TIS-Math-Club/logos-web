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
 * Leadership setting the roster name. Nullable so an operator can clear the
 * override and fall back to the name on the application.
 */
export const UpdateRosterNameSchema = z.object({
  rosterName: nameField.nullable(),
});
export type UpdateRosterNameInput = z.infer<typeof UpdateRosterNameSchema>;

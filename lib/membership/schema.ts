import { z } from "zod";

export const CLUB_MEMBER_STATUSES = ["active", "inactive", "former"] as const;
export type ClubMemberStatus = (typeof CLUB_MEMBER_STATUSES)[number];

export const ActivateMemberInputSchema = z.object({
  applicationId: z.string().uuid("Invalid application ID"),
  reason: z.string().max(256, "Reason must not exceed 256 characters").optional(),
});
export type ActivateMemberInput = z.infer<typeof ActivateMemberInputSchema>;

export const UpdateMemberStatusSchema = z.object({
  status: z.enum(CLUB_MEMBER_STATUSES),
  reason: z.string().max(256, "Reason must not exceed 256 characters").optional(),
});
export type UpdateMemberStatusInput = z.infer<typeof UpdateMemberStatusSchema>;

export interface MemberListItem {
  id: string;
  identityId: string;
  applicationId: string | null;
  preferredName: string;
  email: string;
  grade: string | null;
  status: ClubMemberStatus;
  joinedAt: string;
  leftAt: string | null;
  statusReason: string | null;
  warningCount: number;
}

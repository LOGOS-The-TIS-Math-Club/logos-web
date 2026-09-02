import { z } from "zod";

/** Shared validation for announcement input, used on client and server. */
export const AnnouncementInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give the announcement a title")
    .max(120, "Title must not exceed 120 characters"),
  body: z
    .string()
    .trim()
    .min(1, "Write the announcement")
    .max(2000, "Announcement must not exceed 2000 characters"),
  published: z.boolean(),
});

export type AnnouncementInput = z.infer<typeof AnnouncementInputSchema>;

export interface AnnouncementRecord {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly published: boolean;
  readonly publishedAt: Date | null;
  readonly updatedAt: Date;
}

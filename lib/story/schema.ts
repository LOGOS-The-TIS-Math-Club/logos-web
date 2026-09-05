import { z } from "zod";

/*
 * "Our story" — the club's own history, as dated entries with pictures.
 *
 * Separate from announcements on purpose. An announcement is news that goes
 * stale in a fortnight; a story entry is a record meant to be read years later.
 */

export const StoryEntryInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(120, "Title must not exceed 120 characters"),
  body: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(4000, "Description must not exceed 4000 characters"),
  occurredOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  imageId: z.string().uuid("Invalid image").nullable().optional(),
  published: z.boolean().default(false),
});
export type StoryEntryInput = z.infer<typeof StoryEntryInputSchema>;

/*
 * Written out rather than derived with .partial(): Zod applies a field's
 * .default() even through .partial(), so deriving this would flip `published`
 * back to false on every edit that did not mention it — quietly unpublishing
 * an entry each time somebody fixed a typo.
 */
export const UpdateStoryEntrySchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Title is required")
      .max(120, "Title must not exceed 120 characters"),
    body: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(4000, "Description must not exceed 4000 characters"),
    occurredOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
    imageId: z.string().uuid("Invalid image").nullable(),
    published: z.boolean(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });
export type UpdateStoryEntryInput = z.infer<typeof UpdateStoryEntrySchema>;

/** What the public story page renders. */
export interface PublicStoryEntry {
  id: string;
  title: string;
  body: string;
  occurredOn: string;
  imageId: string | null;
  imageAlt: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
}

/** The leadership view, which also shows unpublished drafts. */
export interface StoryEntryListItem extends PublicStoryEntry {
  published: boolean;
  updatedAt: string;
}

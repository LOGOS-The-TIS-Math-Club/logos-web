import { z } from "zod";

/*
 * A resource card on the member dashboard: a name, a line of description, and
 * a link.
 */

/**
 * https only.
 *
 * These links are rendered as anchors on the member dashboard, so a
 * `javascript:` or `data:` URL saved here would be stored cross-site
 * scripting. z.url() alone permits any scheme, so the protocol is checked
 * explicitly. The same rule is a CHECK constraint on the column, because a
 * validator that only runs in the application is one SQL statement away from
 * being bypassed.
 */
const httpsUrl = z
  .string()
  .trim()
  .min(12, "Link is required")
  .max(2048, "Link must not exceed 2048 characters")
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  }, "Link must be a valid https:// URL");

export const ResourceInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name must not exceed 80 characters"),
  description: z
    .string()
    .trim()
    .min(1, "Description is required")
    .max(280, "Description must not exceed 280 characters"),
  url: httpsUrl,
  sortOrder: z.number().int().min(0).max(999).default(0),
});
export type ResourceInput = z.infer<typeof ResourceInputSchema>;

/*
 * Written out rather than ResourceInputSchema.partial(). Zod applies a field's
 * .default() even when .partial() has made it optional, so an edit that sent
 * only a new title would silently reset sortOrder to 0 and move the card.
 * Verified, not assumed — see the regression test.
 */
export const UpdateResourceSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(80, "Name must not exceed 80 characters"),
    description: z
      .string()
      .trim()
      .min(1, "Description is required")
      .max(280, "Description must not exceed 280 characters"),
    url: httpsUrl,
    sortOrder: z.number().int().min(0).max(999),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update",
  });
export type UpdateResourceInput = z.infer<typeof UpdateResourceSchema>;

export interface ResourceItem {
  id: string;
  title: string;
  description: string;
  url: string;
  sortOrder: number;
}

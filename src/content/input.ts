import { z } from "zod";

export const storyInput = z.object({
  title: z.string().trim().min(1).max(120),
  occurredOn: z.iso.date(),
  description: z.string().trim().max(4000).default(""),
  imageId: z.uuid().nullish(),
  published: z.boolean().default(false),
});

import { z } from "zod";

export const materialsFolderUrl = z
  .url()
  .max(2048)
  .refine((value) => {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      url.hostname === "drive.google.com" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      /^\/drive\/(?:u\/\d+\/)?folders\/[A-Za-z0-9_-]+$/.test(url.pathname)
    );
  }, "Use a specific Google Drive folder link");

export const sessionInput = z.object({
  termId: z.uuid(),
  date: z.iso.date(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  durationMinutes: z.number().int().min(1).max(1440),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(4000).default(""),
  materialsFolderUrl: materialsFolderUrl.nullish(),
  status: z.enum(["scheduled", "cancelled"]).default("scheduled"),
});

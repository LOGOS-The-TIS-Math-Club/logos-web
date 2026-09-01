import "server-only";

import { z } from "zod";

export const WORKSPACE_SCOPES = Object.freeze({
  calendar: "https://www.googleapis.com/auth/calendar.events.readonly",
  drive: "https://www.googleapis.com/auth/drive.metadata.readonly",
  gmail: "https://www.googleapis.com/auth/gmail.send",
});

const GoogleId = z
  .string()
  .trim()
  .min(1)
  .max(1024)
  .regex(/^[A-Za-z0-9_.@-]+$/);
const HttpsUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:");

export const WorkspaceConfigurationSchema = z.object({
  calendarId: GoogleId,
  driveResources: z.record(
    z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
    GoogleId,
  ),
  classroomLinks: z.record(
    z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/),
    HttpsUrl,
  ),
});
export type WorkspaceConfiguration = z.infer<
  typeof WorkspaceConfigurationSchema
>;

export const ServiceAccountCredentialSchema = z.object({
  appEnvironment: z.enum(["development", "production"]),
  clientEmail: z.string().email(),
  privateKey: z.string().includes("BEGIN PRIVATE KEY"),
});

export function parseServiceAccountCredentialConfiguration(
  env: Record<string, string | undefined>,
) {
  const result = ServiceAccountCredentialSchema.safeParse({
    appEnvironment: env.APP_ENV,
    clientEmail: env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL,
    privateKey: env.GOOGLE_WORKSPACE_PRIVATE_KEY,
  });
  if (!result.success)
    throw new Error("Workspace service account is not configured");
  return result.data;
}

export function parseWorkspaceConfiguration(
  env: Record<string, string | undefined>,
): WorkspaceConfiguration {
  let driveResources: unknown;
  let classroomLinks: unknown;
  try {
    driveResources = JSON.parse(env.GOOGLE_DRIVE_RESOURCES ?? "{}");
    classroomLinks = JSON.parse(env.GOOGLE_CLASSROOM_LINKS ?? "{}");
  } catch {
    throw new Error("Workspace configuration is invalid");
  }
  const result = WorkspaceConfigurationSchema.safeParse({
    calendarId: env.GOOGLE_CALENDAR_ID,
    driveResources,
    classroomLinks,
  });
  if (!result.success) throw new Error("Workspace configuration is invalid");
  return result.data;
}

export const GmailCredentialSchema = z.object({
  appEnvironment: z.literal("production"),
  sender: z.literal("mathclub@tokyois.com"),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  refreshToken: z.string().min(1),
});

export function parseGmailCredentialConfiguration(
  env: Record<string, string | undefined>,
) {
  const result = GmailCredentialSchema.safeParse({
    appEnvironment: env.APP_ENV,
    sender: env.GMAIL_SENDER,
    clientId: env.GMAIL_CLIENT_ID,
    clientSecret: env.GMAIL_CLIENT_SECRET,
    refreshToken: env.GMAIL_REFRESH_TOKEN,
  });
  if (!result.success)
    throw new Error("Gmail delivery is not configured for this environment");
  return result.data;
}

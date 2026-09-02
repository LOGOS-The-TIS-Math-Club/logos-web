import { z } from "zod";

const appEnvironmentSchema = z.preprocess((val) => {
  if (typeof val !== "string" || !val.trim()) return "production";
  const lower = val.toLowerCase().trim();
  if (lower === "production" || lower === "prod") return "production";
  if (lower === "preview" || lower === "staging") return "preview";
  if (lower === "development" || lower === "dev") return "development";
  if (lower === "test") return "test";
  return "production";
}, z.enum(["development", "preview", "test", "production"]));

const databaseUrlSchema = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      const protocol = new URL(value).protocol;
      return protocol === "postgres:" || protocol === "postgresql:";
    } catch {
      return false;
    }
  }, "must be a valid PostgreSQL URL");

const runtimeDatabaseEnvironmentSchema = z.object({
  APP_ENV: appEnvironmentSchema,
  DATABASE_URL: databaseUrlSchema,
});

export type AppEnvironment = "development" | "preview" | "test" | "production";

export interface RuntimeDatabaseEnvironment {
  appEnvironment: AppEnvironment;
  databaseUrl: string;
}

function isLocalDatabaseUrl(databaseUrl: string): boolean {
  const hostname = new URL(databaseUrl).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost";
}

function hasRequiredTls(databaseUrl: string): boolean {
  const sslMode = new URL(databaseUrl).searchParams.get("sslmode");
  return sslMode === "require" || sslMode === "verify-full";
}

export function parseRuntimeDatabaseEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): RuntimeDatabaseEnvironment {
  const rawAppEnv =
    environment.APP_ENV ||
    environment.NEXT_PUBLIC_VERCEL_ENV ||
    environment.VERCEL_ENV ||
    environment.NODE_ENV ||
    "production";

  const result = runtimeDatabaseEnvironmentSchema.safeParse({
    ...environment,
    APP_ENV: rawAppEnv,
  });

  if (!result.success) {
    const variableNames = result.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean)
      .join(", ");
    throw new Error(`Invalid database environment: ${variableNames}`);
  }

  if (
    !isLocalDatabaseUrl(result.data.DATABASE_URL) &&
    !hasRequiredTls(result.data.DATABASE_URL)
  ) {
    throw new Error("DATABASE_URL must require TLS for remote databases");
  }

  return {
    appEnvironment: result.data.APP_ENV,
    databaseUrl: result.data.DATABASE_URL,
  };
}

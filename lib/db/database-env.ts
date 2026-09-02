import { z } from "zod";

const APP_ENVIRONMENTS = [
  "development",
  "preview",
  "test",
  "production",
] as const;

const appEnvironmentSchema = z.enum(APP_ENVIRONMENTS);

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

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];

export interface RuntimeDatabaseEnvironment {
  appEnvironment: AppEnvironment;
  databaseUrl: string;
}

function isAppEnvironment(value: string): value is AppEnvironment {
  return (APP_ENVIRONMENTS as readonly string[]).includes(value);
}

/**
 * Resolves the runtime safety label for this deployment.
 *
 * Resolution order is explicit and fails closed. An unrecognised APP_ENV is a
 * hard error rather than a silent coercion: mislabelling a preview deployment
 * as production would let production-only paths run against preview data.
 *
 * `NEXT_PUBLIC_VERCEL_ENV` is deliberately not consulted. Values prefixed with
 * NEXT_PUBLIC_ are inlined into the client bundle and are not a trustworthy
 * source for a server-side safety label.
 */
export function resolveAppEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): AppEnvironment {
  const explicit = environment.APP_ENV?.trim().toLowerCase();
  if (explicit) {
    if (isAppEnvironment(explicit)) {
      return explicit;
    }
    throw new Error(
      `Invalid database environment: APP_ENV must be one of ${APP_ENVIRONMENTS.join(", ")}`,
    );
  }

  // Vercel sets VERCEL_ENV to exactly production | preview | development.
  const platform = environment.VERCEL_ENV?.trim().toLowerCase();
  if (platform === "production") return "production";
  if (platform === "preview") return "preview";
  if (platform === "development") return "development";

  if (environment.NODE_ENV === "test") return "test";

  throw new Error(
    "Invalid database environment: APP_ENV is not set and could not be derived from the platform",
  );
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
  const result = runtimeDatabaseEnvironmentSchema.safeParse({
    ...environment,
    APP_ENV: resolveAppEnvironment(environment),
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

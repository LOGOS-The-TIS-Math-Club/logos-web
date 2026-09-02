/**
 * Configuration readiness for the Google sign-in path.
 *
 * This module reports variable NAMES only. It never returns, logs, or exposes a
 * configured value, so its output is safe to write to server logs and safe to
 * surface to an operator running the preflight script.
 */

const MIN_SECRET_LENGTH = 32;

export interface AuthConfigurationRequirement {
  readonly name: string;
  /** Minimum character length, when the variable is a secret. */
  readonly minLength?: number;
  /** Whether the value must parse as an absolute URL. */
  readonly url?: boolean;
}

export const AUTH_CONFIGURATION_REQUIREMENTS: readonly AuthConfigurationRequirement[] =
  Object.freeze([
    { name: "APP_URL", url: true },
    { name: "DATABASE_URL" },
    { name: "CSRF_SIGNING_SECRET", minLength: MIN_SECRET_LENGTH },
    { name: "RATE_LIMIT_SECRET", minLength: MIN_SECRET_LENGTH },
    { name: "NEON_AUTH_BASE_URL", url: true },
    { name: "NEON_AUTH_COOKIE_SECRET", minLength: MIN_SECRET_LENGTH },
    { name: "GOOGLE_OAUTH_CLIENT_ID" },
  ]);

export interface AuthConfigurationReport {
  readonly ready: boolean;
  /** Names of variables that are absent or empty. */
  readonly missing: readonly string[];
  /** Names of variables that are present but fail their constraint. */
  readonly invalid: readonly string[];
}

export function describeAuthConfiguration(
  environment: Readonly<Record<string, string | undefined>>,
): AuthConfigurationReport {
  const missing: string[] = [];
  const invalid: string[] = [];

  for (const requirement of AUTH_CONFIGURATION_REQUIREMENTS) {
    const value = environment[requirement.name]?.trim();

    if (!value) {
      missing.push(requirement.name);
      continue;
    }

    if (
      requirement.minLength !== undefined &&
      value.length < requirement.minLength
    ) {
      invalid.push(requirement.name);
      continue;
    }

    if (requirement.url) {
      try {
        new URL(value);
      } catch {
        invalid.push(requirement.name);
      }
    }
  }

  return Object.freeze({
    ready: missing.length === 0 && invalid.length === 0,
    missing: Object.freeze(missing),
    invalid: Object.freeze(invalid),
  });
}

/**
 * Builds a single-line, value-free summary suitable for a server log.
 */
export function formatAuthConfigurationReport(
  report: AuthConfigurationReport,
): string {
  if (report.ready) return "ready";
  const parts: string[] = [];
  if (report.missing.length > 0) {
    parts.push(`missing=${report.missing.join(",")}`);
  }
  if (report.invalid.length > 0) {
    parts.push(`invalid=${report.invalid.join(",")}`);
  }
  return parts.join(" ");
}

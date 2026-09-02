#!/usr/bin/env node
/**
 * Auth configuration preflight.
 *
 * Reports which authentication-related environment variables are missing or
 * malformed. Prints variable NAMES and constraints only — never values — so the
 * output is safe to paste into an issue or a chat.
 *
 * Usage:
 *   node scripts/check-auth-config.mjs
 *   vercel env pull .env.production.local && node --env-file=.env.production.local scripts/check-auth-config.mjs
 */

const MIN_SECRET_LENGTH = 32;

const REQUIREMENTS = [
  { name: "APP_ENV", oneOf: ["development", "preview", "test", "production"] },
  { name: "APP_URL", url: true },
  { name: "TRUSTED_ORIGINS", optional: true, originList: true },
  { name: "DATABASE_URL", postgres: true },
  { name: "CSRF_SIGNING_SECRET", minLength: MIN_SECRET_LENGTH },
  { name: "RATE_LIMIT_SECRET", minLength: MIN_SECRET_LENGTH },
  { name: "NEON_AUTH_BASE_URL", url: true },
  { name: "NEON_AUTH_COOKIE_SECRET", minLength: MIN_SECRET_LENGTH },
  { name: "GOOGLE_OAUTH_CLIENT_ID" },
];

const problems = [];
const ok = [];

for (const requirement of REQUIREMENTS) {
  const value = process.env[requirement.name]?.trim();

  if (!value) {
    if (!requirement.optional) {
      problems.push(`${requirement.name}: not set`);
    }
    continue;
  }

  if (requirement.minLength && value.length < requirement.minLength) {
    problems.push(
      `${requirement.name}: ${value.length} characters, needs at least ${requirement.minLength}`,
    );
    continue;
  }

  if (requirement.oneOf && !requirement.oneOf.includes(value.toLowerCase())) {
    problems.push(
      `${requirement.name}: unsupported value, expected one of ${requirement.oneOf.join(", ")}`,
    );
    continue;
  }

  if (requirement.url) {
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "https:" && parsed.hostname !== "localhost") {
        problems.push(`${requirement.name}: must use https outside localhost`);
        continue;
      }
    } catch {
      problems.push(`${requirement.name}: not a valid absolute URL`);
      continue;
    }
  }

  if (requirement.originList) {
    // proxy.ts splits this on ";" and requires canonical origins. A JSON array
    // or a comma-separated list parses as one malformed origin and is silently
    // ignored, which looks configured but is not.
    if (value.startsWith("[") || value.includes(",")) {
      problems.push(
        `${requirement.name}: must be semicolon-separated origins, not a JSON array or comma list`,
      );
      continue;
    }
    let bad = false;
    for (const origin of value
      .split(";")
      .map((o) => o.trim())
      .filter(Boolean)) {
      try {
        const parsed = new URL(origin);
        if (parsed.origin !== origin.replace(/\/$/, "")) {
          problems.push(
            `${requirement.name}: "${origin}" must be a bare origin (scheme + host, no path)`,
          );
          bad = true;
        }
      } catch {
        problems.push(`${requirement.name}: "${origin}" is not a valid origin`);
        bad = true;
      }
    }
    if (bad) continue;
  }

  if (requirement.postgres) {
    try {
      const parsed = new URL(value);
      if (
        parsed.protocol !== "postgres:" &&
        parsed.protocol !== "postgresql:"
      ) {
        problems.push(`${requirement.name}: not a postgres:// URL`);
        continue;
      }
      const local =
        parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
      const sslMode = parsed.searchParams.get("sslmode");
      if (!local && sslMode !== "require" && sslMode !== "verify-full") {
        problems.push(
          `${requirement.name}: remote database must set sslmode=require`,
        );
        continue;
      }
      if (!parsed.pathname || parsed.pathname === "/") {
        problems.push(`${requirement.name}: missing database name in path`);
        continue;
      }
    } catch {
      problems.push(`${requirement.name}: not a valid URL (is it truncated?)`);
      continue;
    }
  }

  ok.push(requirement.name);
}

for (const name of ok) {
  console.log(`  ok       ${name}`);
}

if (problems.length === 0) {
  console.log("\nAuth configuration looks complete.");
  process.exit(0);
}

console.error("");
for (const problem of problems) {
  console.error(`  PROBLEM  ${problem}`);
}
console.error(
  `\n${problems.length} problem(s) found. No values were printed.\n` +
    "Generate a 32-byte secret with:  node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\"",
);
process.exit(1);

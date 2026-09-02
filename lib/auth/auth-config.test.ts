import { describe, expect, test } from "vitest";

import {
  describeAuthConfiguration,
  formatAuthConfigurationReport,
} from "@/lib/auth/auth-config";

const SECRET = "a".repeat(32);

const COMPLETE = {
  APP_URL: "https://tislogos.org",
  DATABASE_URL: "postgresql://host/logos?sslmode=require",
  CSRF_SIGNING_SECRET: SECRET,
  RATE_LIMIT_SECRET: SECRET,
  NEON_AUTH_BASE_URL: "https://auth.example.invalid",
  NEON_AUTH_COOKIE_SECRET: SECRET,
  GOOGLE_OAUTH_CLIENT_ID: "client-id.apps.googleusercontent.com",
} as const;

describe("describeAuthConfiguration", () => {
  test("reports ready when every requirement is satisfied", () => {
    expect(describeAuthConfiguration(COMPLETE)).toMatchObject({
      ready: true,
      missing: [],
      invalid: [],
    });
  });

  test("reports a short secret as invalid, not missing", () => {
    const report = describeAuthConfiguration({
      ...COMPLETE,
      RATE_LIMIT_SECRET: "too-short",
    });
    expect(report.ready).toBe(false);
    expect(report.invalid).toContain("RATE_LIMIT_SECRET");
    expect(report.missing).not.toContain("RATE_LIMIT_SECRET");
  });

  test("treats an empty or whitespace value as missing", () => {
    const report = describeAuthConfiguration({
      ...COMPLETE,
      NEON_AUTH_BASE_URL: "   ",
    });
    expect(report.missing).toContain("NEON_AUTH_BASE_URL");
  });

  test("reports a malformed URL as invalid", () => {
    const report = describeAuthConfiguration({
      ...COMPLETE,
      APP_URL: "not-a-url",
    });
    expect(report.invalid).toContain("APP_URL");
  });

  test("never includes a configured value in its output", () => {
    const secretValue = "super-secret-value-that-must-not-leak-anywhere-0001";
    const report = describeAuthConfiguration({
      ...COMPLETE,
      RATE_LIMIT_SECRET: secretValue,
    });
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain(secretValue);
    expect(formatAuthConfigurationReport(report)).not.toContain(secretValue);
  });

  test("formats a value-free summary naming the failing variables", () => {
    const report = describeAuthConfiguration({
      ...COMPLETE,
      RATE_LIMIT_SECRET: "short",
      GOOGLE_OAUTH_CLIENT_ID: "",
    });
    const summary = formatAuthConfigurationReport(report);
    expect(summary).toContain("missing=GOOGLE_OAUTH_CLIENT_ID");
    expect(summary).toContain("invalid=RATE_LIMIT_SECRET");
  });
});

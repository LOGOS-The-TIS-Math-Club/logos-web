import { describe, expect, test } from "vitest";

import { parseRuntimeDatabaseEnvironment } from "@/lib/db/database-env";

function databaseUrl(host: string, options?: { local?: boolean }) {
  const url = new URL(`${"postgresql:"}//${host}`);
  url.pathname = "/logos";
  if (options?.local) {
    url.username = "local";
    url.port = "5432";
    url.searchParams.set("sslmode", "disable");
  }
  return url.toString();
}

describe("parseRuntimeDatabaseEnvironment", () => {
  test("accepts a local development database without TLS", () => {
    const localDatabaseUrl = databaseUrl("127.0.0.1", { local: true });
    expect(
      parseRuntimeDatabaseEnvironment({
        APP_ENV: "development",
        DATABASE_URL: localDatabaseUrl,
      }),
    ).toEqual({
      appEnvironment: "development",
      databaseUrl: localDatabaseUrl,
    });
  });

  test("requires TLS for a remote database", () => {
    expect(() =>
      parseRuntimeDatabaseEnvironment({
        APP_ENV: "preview",
        DATABASE_URL: databaseUrl("example.invalid"),
      }),
    ).toThrow("DATABASE_URL must require TLS for remote databases");
  });

  test("accepts a remote database that requires TLS", () => {
    const remoteDatabaseUrl = new URL(databaseUrl("example.invalid"));
    remoteDatabaseUrl.searchParams.set("sslmode", "verify-full");
    expect(
      parseRuntimeDatabaseEnvironment({
        APP_ENV: "production",
        DATABASE_URL: remoteDatabaseUrl.toString(),
      }).appEnvironment,
    ).toBe("production");
  });

  test("reports variable names without exposing values", () => {
    const sensitiveValue = "not-a-database-url-with-sensitive-material";

    try {
      parseRuntimeDatabaseEnvironment({
        APP_ENV: "preview",
        DATABASE_URL: sensitiveValue,
      });
      throw new Error("Expected parsing to fail");
    } catch (error) {
      expect(String(error)).toContain("DATABASE_URL");
      expect(String(error)).not.toContain(sensitiveValue);
    }
  });

  test("does not parse configuration at module import", async () => {
    await expect(import("@/lib/db/database-env")).resolves.toBeDefined();
  });
});

describe("resolveAppEnvironment", () => {
  test("rejects an unrecognised APP_ENV instead of coercing it", () => {
    expect(() =>
      parseRuntimeDatabaseEnvironment({
        APP_ENV: "staging",
        DATABASE_URL: "postgresql://127.0.0.1:5432/logos?sslmode=disable",
      }),
    ).toThrow("APP_ENV must be one of");
  });

  test("derives the environment from VERCEL_ENV when APP_ENV is absent", () => {
    expect(
      parseRuntimeDatabaseEnvironment({
        VERCEL_ENV: "preview",
        DATABASE_URL: "postgresql://example.invalid/logos?sslmode=require",
      }).appEnvironment,
    ).toBe("preview");
  });

  test("ignores NEXT_PUBLIC_VERCEL_ENV as a trust source", () => {
    expect(() =>
      parseRuntimeDatabaseEnvironment({
        NEXT_PUBLIC_VERCEL_ENV: "production",
        DATABASE_URL: "postgresql://example.invalid/logos?sslmode=require",
      }),
    ).toThrow("could not be derived");
  });

  test("never silently falls back to production", () => {
    expect(() =>
      parseRuntimeDatabaseEnvironment({
        DATABASE_URL: "postgresql://example.invalid/logos?sslmode=require",
      }),
    ).toThrow("could not be derived");
  });
});

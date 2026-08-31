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

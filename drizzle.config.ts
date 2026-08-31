import { defineConfig } from "drizzle-kit";

const migrationUrl = process.env["MIGRATION_DATABASE_URL"];
const outputDirectory = process.env["DRIZZLE_OUT"] ?? "./drizzle";

if (migrationUrl) {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(migrationUrl);
  } catch {
    throw new Error("MIGRATION_DATABASE_URL must be a valid URL");
  }

  if (
    parsedUrl.protocol !== "postgres:" &&
    parsedUrl.protocol !== "postgresql:"
  ) {
    throw new Error(
      "MIGRATION_DATABASE_URL must use postgres: or postgresql: scheme",
    );
  }
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: outputDirectory,
  dialect: "postgresql",
  ...(migrationUrl ? { dbCredentials: { url: migrationUrl } } : {}),
});

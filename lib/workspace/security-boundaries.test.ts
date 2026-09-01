import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";

import { describe, expect, test } from "vitest";

import { sanitizeString } from "@/lib/security/redaction";
import { ProviderFailure } from "./provider.server";

describe("Workspace security boundaries", () => {
  test("all integration modules are server-only and expose no public credentials", async () => {
    const files: string[] = [];
    for await (const file of glob(
      "lib/{workspace,notifications}/*.server.ts",
    )) {
      files.push(file);
      const source = await readFile(file, "utf8");
      expect(source).toContain('import "server-only"');
      expect(source).not.toContain("NEXT_PUBLIC_");
    }
    expect(files.length).toBeGreaterThan(0);
  });

  test("provider errors and shared telemetry sanitizer contain no recipient, token, or body", () => {
    const error = new ProviderFailure("provider_transient", true);
    expect(error.message).toBe("provider_transient");
    const sanitized = sanitizeString(
      "recipient=student@example.test access_token=synthetic-token-value body=private content",
    );
    expect(sanitized).not.toContain("student@example.test");
    expect(sanitized).not.toContain("synthetic-token-value");
    expect(sanitized).not.toContain("private content");
  });
});

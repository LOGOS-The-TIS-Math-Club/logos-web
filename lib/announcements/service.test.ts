import { drizzle } from "drizzle-orm/neon-serverless";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/identity-access.server", () => ({
  requireCapability: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/security/audit", () => ({
  recordBusinessAuditEvent: vi.fn(),
}));
vi.mock("@/lib/db/client.server", () => ({ withDatabase: vi.fn() }));

import { withDatabase } from "@/lib/db/client.server";
import * as schema from "@/db/schema";
import { listAnnouncementsForManagement } from "./service.server";

describe("managed announcements", () => {
  it("builds an executable query including optional image metadata", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const database = drizzle({ client: { query } as never, schema });
    vi.mocked(withDatabase).mockImplementation((operation) =>
      operation(database),
    );

    await expect(listAnnouncementsForManagement("test")).resolves.toEqual([]);
    expect(query).toHaveBeenCalled();
    expect(query.mock.calls[0][0].text).toContain(
      'left join "content"."images"',
    );
  });
});

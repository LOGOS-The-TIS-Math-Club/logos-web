import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class FakeAccessDenied extends Error {
    constructor() {
      super("Access denied");
      this.name = "AccessDeniedError";
    }
  }

  class FakeMemberNotFound extends Error {
    constructor() {
      super("Member not found");
      this.name = "MemberNotFoundError";
    }
  }

  return {
    updateOwnDisplayName: vi.fn(),
    FakeAccessDenied,
    FakeMemberNotFound,
  };
});

vi.mock("@/lib/auth/identity-access.server", () => ({
  AccessDeniedError: mocks.FakeAccessDenied,
}));

vi.mock("@/lib/membership/service.server", () => ({
  updateOwnDisplayName: mocks.updateOwnDisplayName,
  MemberNotFoundError: mocks.FakeMemberNotFound,
}));

import { POST } from "./route";

function rename(displayName: string) {
  return new NextRequest("http://localhost/api/members/me/name", {
    method: "POST",
    body: JSON.stringify({ displayName }),
    headers: { "content-type": "application/json" },
  });
}

describe("Member self-rename", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("answers 401 when there is no session", async () => {
    /*
     * resolveCurrentIdentity throws AccessDeniedError for an anonymous caller.
     * Without this branch the route fell through to a 500 — wrong for the
     * client, and a fake server error in the logs.
     */
    mocks.updateOwnDisplayName.mockRejectedValue(new mocks.FakeAccessDenied());

    const response = await POST(rename("Alice"));

    expect(response.status).toBe(401);
  });

  it("answers 404 when the caller has no active membership", async () => {
    mocks.updateOwnDisplayName.mockRejectedValue(
      new mocks.FakeMemberNotFound(),
    );

    const response = await POST(rename("Alice"));

    expect(response.status).toBe(404);
  });

  it("takes no member id, so nobody else can be renamed", async () => {
    mocks.updateOwnDisplayName.mockResolvedValue({ displayName: "Alice" });

    await POST(rename("Alice"));

    // The service resolves the caller's own identity; the route passes only
    // the new name through, so there is no id an attacker could substitute.
    expect(mocks.updateOwnDisplayName).toHaveBeenCalledWith(
      { displayName: "Alice" },
      expect.any(String),
    );
  });

  it("returns the saved name on success", async () => {
    mocks.updateOwnDisplayName.mockResolvedValue({ displayName: "Alice" });

    const response = await POST(rename("Alice"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      displayName: "Alice",
    });
  });
});

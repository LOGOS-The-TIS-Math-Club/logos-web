import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireCapability: vi.fn(),
  listApplications: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => ({
    get: (key: string) => (key === "x-correlation-id" ? "test-corr-id" : null),
  }),
}));

vi.mock("@/lib/auth/identity-access.server", () => ({
  requireCapability: mocks.requireCapability,
  AccessDeniedError: class AccessDeniedError extends Error {
    constructor(readonly code: string) {
      super("Access denied");
      this.name = "AccessDeniedError";
    }
  },
}));

vi.mock("@/lib/applications/service.server", () => ({
  listApplicationsForReview: mocks.listApplications,
}));

import { AccessDeniedError } from "@/lib/auth/identity-access.server";
import AdminApplicationsPage from "./page";

describe("AdminApplicationsPage (Server Component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders 403 Access Denied when caller lacks application:review capability", async () => {
    mocks.requireCapability.mockRejectedValue(
      new AccessDeniedError("capability_denied"),
    );

    const jsx = await AdminApplicationsPage();
    render(jsx);

    expect(
      screen.getByRole("heading", { level: 1, name: /403 • Access Denied/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("application:review")).toBeInTheDocument();
  });

  it("renders applicant review list when caller is authorized", async () => {
    mocks.requireCapability.mockResolvedValue({
      identityId: "op-1",
      accessLevel: "operator",
    });

    mocks.listApplications.mockResolvedValue([
      {
        id: "app-1",
        identityId: "user-1",
        email: "student@tokyois.com",
        preferredName: "Alex Rivera",
        grade: "Grade 10",
        academicInterests: ["problem_solving"],
        attendanceConfirmation: "regular",
        status: "submitted",
        statusReason: null,
        submittedAt: new Date("2026-09-01T10:00:00Z"),
        statusUpdatedAt: new Date("2026-09-01T10:00:00Z"),
      },
    ]);

    const jsx = await AdminApplicationsPage();
    render(jsx);

    expect(
      screen.getByRole("heading", { level: 1, name: "Applicant Review" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
  });
});

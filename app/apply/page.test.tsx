import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveIdentity: vi.fn(),
  getMyApplication: vi.fn(),
  push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mocks.push,
  }),
}));

vi.mock("@/lib/auth/identity-access.server", () => ({
  resolveCurrentIdentity: mocks.resolveIdentity,
  AccessDeniedError: class AccessDeniedError extends Error {
    constructor(readonly code: string) {
      super("Access denied");
      this.name = "AccessDeniedError";
    }
  },
}));

vi.mock("@/lib/applications/service.server", () => ({
  getMySubmittedApplication: mocks.getMyApplication,
}));

vi.mock("@/app/auth/auth-controls", () => ({
  SignInButton: () => <button>Mock Sign In</button>,
  SignOutButton: () => <button>Mock Sign Out</button>,
}));

import { AccessDeniedError } from "@/lib/auth/identity-access.server";
import ApplyPage from "./page";

describe("ApplyPage (Server Component)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders identification prompt when not authenticated", async () => {
    mocks.resolveIdentity.mockRejectedValue(
      new AccessDeniedError("session_invalid"),
    );

    const jsx = await ApplyPage();
    render(jsx);

    expect(
      screen.getByRole("heading", { level: 1, name: "Apply to LOGOS" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Step 1: Identify with your School Account/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Mock Sign In")).toBeInTheDocument();
  });

  it("renders account verification notice when affiliation is unverified", async () => {
    mocks.resolveIdentity.mockResolvedValue({
      identityId: "user-1",
      email: "guest@external.com",
      affiliationStatus: "pending_verification",
      active: true,
      accessLevel: "basic",
    });

    const jsx = await ApplyPage();
    render(jsx);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Account Verification Required",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Unsupported Account: guest@external.com/i),
    ).toBeInTheDocument();
  });

  it("renders existing application status when application is already on file", async () => {
    mocks.resolveIdentity.mockResolvedValue({
      identityId: "user-1",
      email: "student@tokyois.com",
      affiliationStatus: "verified",
      active: true,
      accessLevel: "basic",
    });

    mocks.getMyApplication.mockResolvedValue({
      id: "app-1",
      preferredName: "Alex Rivera",
      grade: "Grade 10",
      status: "submitted",
      submittedAt: new Date("2026-09-01T10:00:00Z"),
    });

    const jsx = await ApplyPage();
    render(jsx);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Application On File",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("SUBMITTED")).toBeInTheDocument();
  });

  it("renders application form when student is verified and has no existing application", async () => {
    mocks.resolveIdentity.mockResolvedValue({
      identityId: "user-1",
      email: "student@tokyois.com",
      affiliationStatus: "verified",
      active: true,
      accessLevel: "basic",
    });

    mocks.getMyApplication.mockResolvedValue(null);

    const jsx = await ApplyPage();
    render(jsx);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "LOGOS Student Application",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("student@tokyois.com")).toBeInTheDocument();
    expect(screen.getByLabelText(/1\. Preferred Name/i)).toBeInTheDocument();
  });
});

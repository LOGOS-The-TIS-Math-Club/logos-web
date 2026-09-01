import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { WarningsAdminView } from "./warnings-admin-view";
import { type WarningListItem } from "@/lib/attendance/schema";
import { type MemberListItem } from "@/lib/membership/schema";

describe("WarningsAdminView", () => {
  const mockWarnings: WarningListItem[] = [
    {
      id: "warn-1",
      memberId: "member-1",
      memberName: "Alice Chen",
      memberEmail: "alice@tokyois.com",
      reason: "Unnotified absence for 3 consecutive meetings",
      notes: "Followed up in person",
      active: true,
      issuedAt: "2026-09-01T00:00:00.000Z",
      resolvedAt: null,
    },
  ];

  const mockMembers: MemberListItem[] = [
    {
      id: "member-1",
      identityId: "identity-1",
      applicationId: "app-1",
      preferredName: "Alice Chen",
      email: "alice@tokyois.com",
      grade: "Grade 11",
      status: "active",
      joinedAt: "2026-09-01T00:00:00.000Z",
      leftAt: null,
      statusReason: null,
      warningCount: 1,
    },
  ];

  it("renders active warnings and action buttons", () => {
    render(
      <WarningsAdminView
        initialWarnings={mockWarnings}
        members={mockMembers}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Manual Warnings" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    expect(
      screen.getByText("Unnotified absence for 3 consecutive meetings"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Mark Resolved" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ Issue Manual Warning" }),
    ).toBeInTheDocument();
  });
});

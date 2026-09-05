import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  type AcceptedApplicationItem,
  MemberAdminView,
} from "./member-admin-view";
import { type MemberListItem } from "@/lib/membership/schema";

describe("MemberAdminView", () => {
  const mockMembers: MemberListItem[] = [
    {
      id: "member-1",
      identityId: "identity-1",
      applicationId: "app-1",
      preferredName: "Alice Chen",
      rosterName: "Alice Chen",
      displayName: null,
      appliedGrade: null,
      cohortYear: null,
      gradeOverride: null,
      email: "alice@tokyois.com",
      grade: "Grade 11",
      status: "active",
      joinedAt: "2026-09-01T00:00:00.000Z",
      leftAt: null,
      statusReason: null,
      warningCount: 0,
    },
    {
      id: "member-2",
      identityId: "identity-2",
      applicationId: "app-2",
      preferredName: "Bob Smith",
      rosterName: "Bob Smith",
      displayName: null,
      appliedGrade: null,
      cohortYear: null,
      gradeOverride: null,
      email: "bob@tokyois.com",
      grade: "Grade 10",
      status: "inactive",
      joinedAt: "2026-08-15T00:00:00.000Z",
      leftAt: "2026-09-01T00:00:00.000Z",
      statusReason: "Study leave",
      warningCount: 1,
    },
  ];

  const mockPending: AcceptedApplicationItem[] = [
    {
      id: "app-3",
      identityId: "identity-3",
      preferredName: "Charlie Brown",
      email: "charlie@tokyois.com",
      grade: "Grade 9",
      submittedAt: "2026-09-01T00:00:00.000Z",
    },
  ];

  it("renders member table and pending activations", () => {
    render(
      <MemberAdminView
        initialMembers={mockMembers}
        acceptedApplications={mockPending}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Club Members" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: /Ready for Membership Activation/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Charlie Brown")).toBeInTheDocument();
  });
});

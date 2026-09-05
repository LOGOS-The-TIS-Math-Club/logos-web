import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MemberHubView } from "./member-hub-view";

describe("MemberHubView", () => {
  const mockMember = {
    id: "member-1",
    preferredName: "Alice Chen",
    displayName: "Alice Chen",
    email: "alice@tokyois.com",
    grade: "Grade 11",
    status: "active",
    joinedAt: "2026-09-01T00:00:00.000Z",
  };

  const mockSession = {
    id: "session-1",
    title: "LOGOS Weekly Meeting",
    sessionDate: "2026-09-04",
    startTime: "15:30",
    endTime: "16:30",
    location: "Room 101",
    notes: "Combinatorics and Number Theory",
    driveFolderId: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    presentCount: 12,
    totalMarked: 15,
  };

  const mockTotals = {
    totalSessions: 10,
    presentCount: 8,
    lateCount: 1,
    excusedCount: 1,
    unexcusedCount: 0,
    unmarkedCount: 0,
    attendanceRate: 85,
  };

  const mockResources = [
    {
      id: "res-1",
      title: "Google Classroom",
      description: "Weekly problem sets and handouts.",
      url: "https://classroom.google.com/c/example",
      sortOrder: 0,
    },
  ];

  it("renders member profile, upcoming meeting, and attendance statistics", () => {
    render(
      <MemberHubView
        member={mockMember}
        upcomingSession={mockSession}
        sessions={[mockSession]}
        attendanceTotals={mockTotals}
        resources={mockResources}
      />,
    );

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Welcome back, Alice Chen",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Next Club Meeting" }),
    ).toBeInTheDocument();
    // The session appears twice by design — once as the next meeting and once
    // in the full list — so this targets the next-meeting heading specifically.
    expect(
      screen.getByRole("heading", { name: "LOGOS Weekly Meeting" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /session details and materials/i }),
    ).toHaveAttribute("href", "/members/sessions/session-1");
    expect(screen.getByText(/15:30 – 16:30 • Room 101/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "My Attendance Record" }),
    ).toBeInTheDocument();
    expect(screen.getByText("85%")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Submit absence notice" }),
    ).toBeInTheDocument();
  });
});

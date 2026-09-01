import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

import { AttendanceAdminView } from "./attendance-admin-view";
import {
  type MemberSessionAttendance,
  type SessionListItem,
} from "@/lib/attendance/schema";

describe("AttendanceAdminView", () => {
  const mockSessions: SessionListItem[] = [
    {
      id: "session-1",
      title: "LOGOS Weekly Meeting",
      sessionDate: "2026-09-04",
      startTime: "15:30",
      endTime: "16:30",
      location: "Room 101",
      notes: null,
      createdAt: "2026-09-01T00:00:00.000Z",
      presentCount: 1,
      totalMarked: 1,
    },
  ];

  const mockRoster: MemberSessionAttendance[] = [
    {
      memberId: "member-1",
      preferredName: "Alice Chen",
      email: "alice@tokyois.com",
      grade: "Grade 11",
      status: "present",
      notes: null,
      expectedAbsence: null,
    },
    {
      memberId: "member-2",
      preferredName: "Bob Smith",
      email: "bob@tokyois.com",
      grade: "Grade 10",
      status: "excused_absence",
      notes: null,
      expectedAbsence: {
        id: "absence-1",
        reason: "Debate tournament",
        status: "submitted",
      },
    },
  ];

  it("renders attendance ledger and member roster with expected absence notes", () => {
    render(
      <AttendanceAdminView
        sessions={mockSessions}
        initialSelectedSessionId="session-1"
        initialRoster={mockRoster}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Attendance Ledger" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Alice Chen")).toBeInTheDocument();
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
    expect(screen.getByText(/Debate tournament/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Save Attendance Ledger" }),
    ).toBeInTheDocument();
  });
});

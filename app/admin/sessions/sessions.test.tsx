import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SessionAdminView } from "./session-admin-view";
import { type SessionListItem } from "@/lib/attendance/schema";

describe("SessionAdminView", () => {
  const mockSessions: SessionListItem[] = [
    {
      id: "session-1",
      title: "LOGOS Weekly Meeting",
      sessionDate: "2026-09-04",
      startTime: "15:30",
      endTime: "16:30",
      location: "Room 101",
      notes: "Combinatorics and Number Theory",
      createdAt: "2026-09-01T00:00:00.000Z",
      presentCount: 12,
      totalMarked: 15,
    },
  ];

  it("renders sessions list and create session action", () => {
    render(<SessionAdminView initialSessions={mockSessions} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Club Sessions" }),
    ).toBeInTheDocument();
    expect(screen.getByText("LOGOS Weekly Meeting")).toBeInTheDocument();
    expect(screen.getByText("2026-09-04")).toBeInTheDocument();
    expect(screen.getByText("Room 101")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ Create New Session" }),
    ).toBeInTheDocument();
  });
});

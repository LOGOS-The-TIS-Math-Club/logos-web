import { fireEvent, render, screen } from "@testing-library/react";
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

  it("offers an edit action per session", () => {
    render(<SessionAdminView initialSessions={mockSessions} />);

    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("prefills the form from the session being edited", () => {
    render(<SessionAdminView initialSessions={mockSessions} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(
      screen.getByRole("heading", { name: "Edit Club Session" }),
    ).toBeInTheDocument();
    // The date and the topic are what leadership edits; both must arrive
    // populated rather than reset to the create-form defaults.
    expect(screen.getByLabelText("Topic")).toHaveValue("LOGOS Weekly Meeting");
    expect(screen.getByLabelText("Date")).toHaveValue("2026-09-04");
    expect(screen.getByLabelText("Location")).toHaveValue("Room 101");
    expect(
      screen.getByRole("button", { name: "Save Changes" }),
    ).toBeInTheDocument();
  });

  it("opens a blank form for a new session after an edit was opened", () => {
    render(<SessionAdminView initialSessions={mockSessions} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(
      screen.getByRole("button", { name: "+ Create New Session" }),
    );

    // Otherwise the create form would still carry the edited session's values
    // and quietly duplicate it.
    expect(
      screen.getByRole("heading", { name: "Create Club Session" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Date")).not.toHaveValue("2026-09-04");
    expect(
      screen.getByRole("button", { name: "Create Session" }),
    ).toBeInTheDocument();
  });
});

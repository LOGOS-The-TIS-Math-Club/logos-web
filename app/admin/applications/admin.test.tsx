import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type ApplicationAdminItem,
  ApplicationAdminView,
} from "./application-admin-view";

describe("ApplicationAdminView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  const mockApplications: ApplicationAdminItem[] = [
    {
      id: "app-1",
      identityId: "user-1",
      email: "student1@tokyois.com",
      preferredName: "Alex Rivera",
      grade: "Grade 10",
      academicInterests: ["problem_solving", "algebra"],
      attendanceConfirmation: "regular",
      status: "submitted",
      statusReason: null,
      submittedAt: new Date("2026-09-01T10:00:00Z"),
      statusUpdatedAt: new Date("2026-09-01T10:00:00Z"),
    },
    {
      id: "app-2",
      identityId: "user-2",
      email: "student2@tokyois.com",
      preferredName: "Taylor Swift",
      grade: "Grade 12",
      academicInterests: ["geometry"],
      attendanceConfirmation: "occasional_conflicts",
      status: "accepted",
      statusReason: "Strong math background",
      submittedAt: new Date("2026-09-01T11:00:00Z"),
      statusUpdatedAt: new Date("2026-09-01T11:30:00Z"),
    },
  ];

  it("renders applicant review heading, export link, and list items", () => {
    render(<ApplicationAdminView initialApplications={mockApplications} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Applicant Review" }),
    ).toBeInTheDocument();

    const exportLink = screen.getByRole("link", {
      name: /Export Applications \(CSV\)/i,
    });
    expect(exportLink).toHaveAttribute(
      "href",
      "/api/admin/applications/export",
    );

    expect(screen.getByText("Alex Rivera")).toBeInTheDocument();
    expect(screen.getByText("Taylor Swift")).toBeInTheDocument();
  });

  it("filters applications by status tabs", () => {
    render(<ApplicationAdminView initialApplications={mockApplications} />);

    const acceptedTab = screen.getByRole("button", { name: /Accepted/i });
    fireEvent.click(acceptedTab);

    expect(screen.getByText("Taylor Swift")).toBeInTheDocument();
    expect(screen.queryByText("Alex Rivera")).not.toBeInTheDocument();
  });

  it("opens application detail panel and handles status update", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        applicationId: "app-1",
        status: "reviewing",
        statusReason: "Needs mentor review",
      }),
    });

    render(<ApplicationAdminView initialApplications={mockApplications} />);

    // Click Alex Rivera's card
    const card = screen.getByRole("button", {
      name: /View application for Alex Rivera/i,
    });
    fireEvent.click(card);

    // Detail panel should display
    expect(
      screen.getByRole("heading", { level: 2, name: "Application Details" }),
    ).toBeInTheDocument();

    // Change status to reviewing
    const statusSelect = screen.getByRole("combobox");
    fireEvent.change(statusSelect, { target: { value: "reviewing" } });

    // Submit update
    const saveBtn = screen.getByRole("button", { name: "Save Status Update" });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/admin/applications/status",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"status":"reviewing"'),
        }),
      );
      expect(
        screen.getByText(/Status updated to REVIEWING/i),
      ).toBeInTheDocument();
    });
  });
});

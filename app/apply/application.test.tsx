import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

import { ApplicationForm } from "./application-form";

describe("ApplicationForm Accessibility and Interaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders all required accessible form controls and legends", () => {
    render(<ApplicationForm verifiedEmail="student@tokyois.com" />);

    expect(screen.getByText("student@tokyois.com")).toBeInTheDocument();

    expect(screen.getByLabelText(/1\. Preferred Name/i)).toBeInTheDocument();

    expect(screen.getByText(/2\. Grade Level/i)).toBeInTheDocument();

    expect(screen.getByText(/3\. Mathematical Interests/i)).toBeInTheDocument();

    expect(
      screen.getByLabelText(/4\. Why would you like to join LOGOS\?/i),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(
        /5\. What would you like to learn or contribute\?/i,
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(/6\. Relevant Background or Experience/i),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/7\. Regular Meeting Availability/i),
    ).toBeInTheDocument();

    expect(
      screen.getByLabelText(
        /I confirm that the information provided is accurate/i,
      ),
    ).toBeInTheDocument();
  });

  it("shows accessible validation error summary and inline errors on invalid submission", async () => {
    render(<ApplicationForm verifiedEmail="student@tokyois.com" />);

    const submitBtn = screen.getByRole("button", {
      name: /Submit Application/i,
    });
    fireEvent.click(submitBtn);

    expect(
      await screen.findByRole("alert", {
        name: /Please correct the errors below to submit/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getAllByText(/Please enter your preferred name/i).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("submits valid application and navigates to confirmation", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, applicationId: "app-test-123" }),
    });

    render(<ApplicationForm verifiedEmail="student@tokyois.com" />);

    // 1. Preferred Name
    fireEvent.change(screen.getByLabelText(/1\. Preferred Name/i), {
      target: { value: "Alex Rivera" },
    });

    // 2. Grade
    fireEvent.click(screen.getByLabelText("Grade 10"));

    // 3. Interests
    fireEvent.click(screen.getByLabelText(/Problem solving & Olympiad math/i));

    // 4. Why Join
    fireEvent.change(
      screen.getByLabelText(/4\. Why would you like to join LOGOS\?/i),
      {
        target: {
          value:
            "I love challenging math problems and want to collaborate with other passionate students.",
        },
      },
    );

    // 5. Goals
    fireEvent.change(
      screen.getByLabelText(
        /5\. What would you like to learn or contribute\?/i,
      ),
      {
        target: {
          value:
            "I want to learn competitive number theory and help organize club workshop rounds.",
        },
      },
    );

    // 6. Attendance
    fireEvent.click(screen.getByLabelText(/Yes, I can attend regularly/i));

    // 7. Acknowledgement
    fireEvent.click(
      screen.getByLabelText(
        /I confirm that the information provided is accurate/i,
      ),
    );

    // Submit
    const submitBtn = screen.getByRole("button", {
      name: /Submit Application/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/applications",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Alex Rivera"),
        }),
      );
      expect(mockPush).toHaveBeenCalledWith("/apply/confirmation");
    });
  });
});

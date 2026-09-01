import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ConfirmationPage from "./page";

describe("Application ConfirmationPage", () => {
  it("renders success confirmation, schedule reminder, and return home link", () => {
    render(<ConfirmationPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "Application Received" }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Thank you for applying to LOGOS/i),
    ).toBeInTheDocument();

    expect(screen.getByText(/What Happens Next/i)).toBeInTheDocument();

    expect(
      screen.getByText(
        /Every Friday after school from 15:30 to 16:30 in Room 101/i,
      ),
    ).toBeInTheDocument();

    const homeLink = screen.getByRole("link", { name: /Return to Home/i });
    expect(homeLink).toBeInTheDocument();
    expect(homeLink).toHaveAttribute("href", "/");
  });
});

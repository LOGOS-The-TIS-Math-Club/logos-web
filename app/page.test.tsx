import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home recruitment landing page", () => {
  it("renders the main heading and recruitment call to action", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Explore Mathematics Beyond the Classroom",
      }),
    ).toBeInTheDocument();

    const applyLinks = screen.getAllByRole("link", { name: /Apply/i });
    expect(applyLinks.length).toBeGreaterThanOrEqual(1);
    expect(applyLinks[0]).toHaveAttribute("href", "/apply");
  });

  it("renders activities, eligibility, and meeting details accessibly", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 2, name: "What Students Do" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Who Can Join" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Meeting Schedule" }),
    ).toBeInTheDocument();

    expect(screen.getByText(/Grades 9–12/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Every Friday after school, 15:30–16:30/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Room 101/i)).toBeInTheDocument();
  });
});

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

    expect(
      screen.getAllByText(/Grades 9–12/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/Every Friday after school, 15:30–16:30/i),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Room 101/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders about, leadership, resources, privacy, and contact sections", () => {
    render(<Home />);

    expect(
      screen.getByRole("heading", { level: 2, name: "About LOGOS Math Club" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Leadership & Supervision" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Competition Pathways and Learning Archives",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Student Privacy & Account Handling",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "Contact & Inquiries" }),
    ).toBeInTheDocument();
  });
});



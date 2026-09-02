import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home recruitment landing page", () => {
  it("renders the main heading and recruitment call to action", () => {
    render(<Home />);

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent(/Mathematics,\s*taken seriously\./);

    const applyLinks = screen.getAllByRole("link", { name: /apply to logos/i });
    expect(applyLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of applyLinks) {
      expect(link).toHaveAttribute("href", "/apply");
    }
  });

  it("states the confirmed meeting facts and eligibility", () => {
    render(<Home />);

    expect(screen.getByText("Friday")).toBeInTheDocument();
    expect(screen.getByText("15:30–16:30")).toBeInTheDocument();
    expect(screen.getByText("Room 101")).toBeInTheDocument();
    expect(screen.getAllByText(/Grades 9/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getAllByText(/no prior competition experience/i).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("renders each public section with an accessible heading", () => {
    render(<Home />);

    for (const name of [
      "A club built on reasoning, not recall.",
      "Algebra, in depth.",
      "Open to every high school student.",
      "Three steps, about five minutes.",
      "Before you apply.",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name }),
      ).toBeInTheDocument();
    }
  });

  it("explains that Google sign-in does not grant membership", () => {
    render(<Home />);

    expect(
      screen.getByText(/It does not make you a member\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Does signing in with Google make me a member\?/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Membership is a separate decision/i),
    ).toBeInTheDocument();
  });

  it("makes no competition or archive claim that lacks an official source", () => {
    const { container } = render(<Home />);
    const text = container.textContent ?? "";

    for (const unsourced of [
      "AMC",
      "AIME",
      "Euclid",
      "Fermat",
      "CEMC",
      "Waterloo",
      "Olympiad",
      "Google Classroom",
    ]) {
      expect(text).not.toContain(unsourced);
    }
  });

  it("does not imply LOGOS has entered an external competition", () => {
    const { container } = render(<Home />);
    const text = container.textContent ?? "";

    // The club runs in-club contests but has never entered an outside one.
    expect(text).toContain("In-club competitions");

    // Word-boundary matching: "national" is a substring of "International".
    for (const pattern of [
      /takes part in competitions/i,
      /competed in\b/i,
      /\bnational\b/i,
      /\bregional\b/i,
      /\btournaments?\b/i,
      /\binter-?school\b/i,
    ]) {
      expect(text).not.toMatch(pattern);
    }
  });
});

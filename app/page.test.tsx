import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import Home from "./page";

describe("Home noticeboard", () => {
  it("leads with the club identity and the application action", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Mathematics,\s*taken seriously\./,
    );

    const applyLinks = screen.getAllByRole("link", { name: /apply to logos/i });
    expect(applyLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of applyLinks) {
      expect(link).toHaveAttribute("href", "/apply");
    }
  });

  it("shows what the club is doing now rather than a standing description", () => {
    render(<Home />);

    for (const name of [
      "What we did.",
      "Where we’re going.",
      "Announcements.",
    ]) {
      expect(
        screen.getByRole("heading", { level: 2, name }),
      ).toBeInTheDocument();
    }
  });

  it("renders a graceful empty state when there are no announcements", () => {
    render(<Home />);

    // The content module ships with no announcements, so the fallback copy
    // must carry the meeting facts instead of leaving a gap.
    expect(screen.getByText(/No announcements right now/i)).toBeInTheDocument();
    // Room 101 appears in the banner too, so more than one match is expected.
    expect(screen.getAllByText(/Room 101/i).length).toBeGreaterThanOrEqual(1);
  });

  it("makes no claim that lacks an official source", () => {
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

    // Word boundaries: "national" is a substring of "International".
    for (const pattern of [
      /takes part in competitions/i,
      /\bnational\b/i,
      /\bregional\b/i,
      /\btournaments?\b/i,
    ]) {
      expect(text).not.toMatch(pattern);
    }
  });
});

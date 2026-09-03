import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Home is an async Server Component that reads published announcements from
 * the database. The service is mocked so these tests stay a pure render check
 * and never reach Neon Auth or Postgres.
 */
const listPublishedAnnouncements = vi.hoisted(() => vi.fn());

vi.mock("@/lib/announcements/service.server", () => ({
  listPublishedAnnouncements,
}));

import Home from "./page";

/** Home is async, so it must be awaited before rendering. */
async function renderHome() {
  return render(await Home());
}

describe("Home noticeboard", () => {
  beforeEach(() => {
    listPublishedAnnouncements.mockReset();
    listPublishedAnnouncements.mockResolvedValue([]);
  });

  it("leads with the club identity and the application action", async () => {
    await renderHome();

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /Mathematics,\s*taken seriously\./,
    );

    const applyLinks = screen.getAllByRole("link", { name: /apply to logos/i });
    expect(applyLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of applyLinks) {
      expect(link).toHaveAttribute("href", "/apply");
    }
  });

  it("shows what the club is doing now rather than a standing description", async () => {
    await renderHome();

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

  it("renders a graceful empty state when there are no announcements", async () => {
    await renderHome();

    // The content module ships with no announcements, so the fallback copy
    // must carry the meeting facts instead of leaving a gap.
    expect(screen.getByText(/No announcements right now/i)).toBeInTheDocument();
    // Room 101 appears in the banner too, so more than one match is expected.
    expect(screen.getAllByText(/Room 101/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders announcements published from the admin editor", async () => {
    // The point of the database-backed CMS: leadership publishes, and the
    // public page shows it without a deploy.
    listPublishedAnnouncements.mockResolvedValue([
      {
        id: "a1",
        title: "No meeting this Friday",
        body: "Room 101 is booked for exams, so we are skipping this week.",
        publishedAt: new Date("2026-09-02T09:00:00Z"),
      },
    ]);

    await renderHome();

    expect(screen.getByText("No meeting this Friday")).toBeInTheDocument();
    expect(
      screen.getByText(/Room 101 is booked for exams/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No announcements right now/i),
    ).not.toBeInTheDocument();
  });

  it("still renders if the announcement query fails", async () => {
    // A database outage must not take down the public page.
    listPublishedAnnouncements.mockRejectedValue(new Error("db unavailable"));

    await renderHome();

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/No announcements right now/i)).toBeInTheDocument();
  });

  it("makes no claim that lacks an official source", async () => {
    const { container } = await renderHome();
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

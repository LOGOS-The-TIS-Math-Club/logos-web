/*
 * Editable club content.
 *
 * This is the one file to change for weekly updates, the semester plan and
 * announcements. It is plain data with no database and no CMS: edit, commit,
 * and Vercel redeploys. That is a deliberate trade — a club posting once a week
 * does not need a content system, and this keeps everything reviewable.
 *
 * Every session below comes from the official 2026 curriculum in the Drive
 * programmes folder. Do not add claims here that are not true of the club.
 */

/**
 * Public contact address for the club.
 *
 * See docs/school-it-requests.md item 1: this is a school Workspace address,
 * so it must exist as a group or shared mailbox before it will receive mail.
 * Publishing it is deliberate — it is the sustainable address across leadership
 * handovers, unlike a personal account.
 */
export const CONTACT_EMAIL = "mathclub@tokyois.com";

export interface SessionEntry {
  /** ISO date, so it sorts and formats predictably. */
  readonly date: string;
  readonly topic: string;
  /** Written after the session. Omit until it has actually happened. */
  readonly note?: string;
}

/**
 * The 2026 programme. `note` is filled in after each Friday.
 * Dates are the Fridays from the official curriculum sheet.
 */
export const SESSIONS: readonly SessionEntry[] = [
  { date: "2026-09-04", topic: "Algebra diagnostic and introduction" },
  {
    date: "2026-09-11",
    topic: "Multiplication identities and polynomial structure",
  },
  { date: "2026-09-18", topic: "Factoring complex polynomial expressions" },
  { date: "2026-09-25", topic: "Identities and undetermined coefficients" },
  { date: "2026-10-02", topic: "Remainder theorem and factor theorem" },
  { date: "2026-10-09", topic: "Real and complex numbers" },
  {
    date: "2026-10-30",
    topic: "Roots, discriminants, and root–coefficient relationships",
  },
  {
    date: "2026-11-13",
    topic: "Structural methods for cubic and quartic equations",
  },
];

export interface Announcement {
  readonly date: string;
  readonly title: string;
  readonly body: string;
}

/**
 * Public announcements, newest first. Safe to leave empty — the page renders a
 * proper empty state rather than a gap.
 */
export const ANNOUNCEMENTS: readonly Announcement[] = [];

/** One line describing what the club is working through this term. */
export const SEMESTER_FOCUS =
  "Term one works through algebraic structure in depth — identities, polynomial factorisation, the remainder and factor theorems, and the methods that make cubics and quartics tractable.";

/**
 * Returns the most recent session on or before `today`, and the next one after.
 * Pure and dependency-free so it can be unit tested.
 */
export function splitSessions(
  sessions: readonly SessionEntry[],
  today: Date,
): { past: readonly SessionEntry[]; next: SessionEntry | null } {
  const stamp = today.getTime();
  const past = sessions.filter((s) => new Date(s.date).getTime() <= stamp);
  const next = sessions.find((s) => new Date(s.date).getTime() > stamp) ?? null;
  return { past, next };
}

export function formatSessionDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

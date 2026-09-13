import type { SessionListItem } from "./schema";

function tokyoCalendarDate(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Selects the nearest session that has not yet passed in the club's Tokyo
 * calendar. The list may be displayed in another order elsewhere.
 */
export function selectNextUpcomingSession(
  sessions: SessionListItem[],
  now = new Date(),
): SessionListItem | null {
  const today = tokyoCalendarDate(now);

  return sessions.reduce<SessionListItem | null>((nearest, session) => {
    if (session.sessionDate < today) return nearest;
    if (!nearest) return session;

    if (session.sessionDate < nearest.sessionDate) return session;
    if (
      session.sessionDate === nearest.sessionDate &&
      session.startTime < nearest.startTime
    ) {
      return session;
    }

    return nearest;
  }, null);
}

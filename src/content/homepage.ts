import type { PublicAnnouncement } from "./operations.ts";
import type { PublicSessionSummary } from "../sessions/public.ts";

export type PublicRead<T> =
  { status: "available"; data: T } | { status: "unavailable" };
export type HomepageReads = {
  announcements: () => PromiseLike<readonly PublicAnnouncement[]>;
  clubInfo: () => PromiseLike<{ semester_focus: string } | null>;
  sessions: () => PromiseLike<PublicSessionSummary>;
};

// Separate failures: a noticeboard outage must not hide a readable term focus.
export async function readHomepage(reads: HomepageReads) {
  const [announcements, clubInfo, sessions] = await Promise.allSettled([
    Promise.resolve().then(reads.announcements),
    Promise.resolve().then(reads.clubInfo),
    Promise.resolve().then(reads.sessions),
  ]);
  return {
    sessions:
      sessions.status === "fulfilled"
        ? ({ status: "available", data: sessions.value } as const)
        : ({ status: "unavailable" } as const),
    announcements:
      announcements.status === "fulfilled"
        ? ({ status: "available", data: announcements.value } as const)
        : ({ status: "unavailable" } as const),
    focus:
      clubInfo.status === "fulfilled"
        ? ({
            status: "available",
            data: clubInfo.value?.semester_focus.trim() || null,
          } as const)
        : ({ status: "unavailable" } as const),
  };
}

export function formatPublicationDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

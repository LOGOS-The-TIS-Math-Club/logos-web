import "server-only";

import { z } from "zod";

import {
  failureForStatus,
  fetchWithTimeout,
  ProviderFailure,
  readJson,
  type AccessTokenProvider,
} from "./provider.server";

const EventDate = z
  .object({
    date: z.string().date().optional(),
    dateTime: z.string().datetime({ offset: true }).optional(),
  })
  .refine((value) => Boolean(value.date || value.dateTime));
const GoogleEvent = z.object({
  id: z.string().min(1).max(1024),
  summary: z.string().max(1000).optional().default("Untitled event"),
  htmlLink: z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        (url.hostname === "calendar.google.com" ||
          url.hostname.endsWith(".calendar.google.com"))
      );
    })
    .optional(),
  status: z.string().optional(),
  start: EventDate,
  end: EventDate,
});
const GoogleEvents = z.object({
  items: z.array(GoogleEvent).max(250).optional().default([]),
});

export interface CalendarEvent {
  readonly id: string;
  readonly title: string;
  readonly start: string;
  readonly end: string;
  readonly link?: string;
}
export type CalendarResult =
  | {
      status: "available";
      freshness: "fresh" | "stale";
      fetchedAt: string;
      events: readonly CalendarEvent[];
    }
  | { status: "unavailable"; code: "calendar_unavailable" };

export interface CalendarProvider {
  list(signal: AbortSignal): Promise<unknown>;
}

export class GoogleCalendarProvider implements CalendarProvider {
  constructor(
    private readonly calendarId: string,
    private readonly tokens: AccessTokenProvider,
    private readonly timeoutMs = 5000,
    private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(signal: AbortSignal): Promise<unknown> {
    const token = await this.tokens.getAccessToken(signal);
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(this.calendarId)}/events`,
    );
    const timeMin = this.now();
    const timeMax = new Date(timeMin);
    timeMax.setUTCDate(timeMax.getUTCDate() + 366);
    url.search = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      showDeleted: "false",
      maxResults: "100",
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      fields: "items(id,summary,htmlLink,status,start,end)",
    }).toString();
    const response = await fetchWithTimeout(
      url,
      { headers: { authorization: `Bearer ${token}` }, signal },
      this.timeoutMs,
      this.fetcher,
    );
    if (!response.ok) throw failureForStatus(response.status);
    return readJson(response);
  }
}

export class CalendarService {
  private lastGood?: {
    fetchedAt: string;
    expiresAt: number;
    events: readonly CalendarEvent[];
  };

  constructor(
    private readonly provider: CalendarProvider,
    private readonly ttlMs = 60_000,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async list(): Promise<CalendarResult> {
    const current = this.now();
    if (this.lastGood && current.getTime() < this.lastGood.expiresAt) {
      return {
        status: "available",
        freshness: "fresh",
        fetchedAt: this.lastGood.fetchedAt,
        events: this.lastGood.events,
      };
    }
    try {
      const parsed = GoogleEvents.parse(
        await this.provider.list(AbortSignal.timeout(10_000)),
      );
      const events = parsed.items
        .filter((event) => event.status !== "cancelled")
        .map((event) => ({
          id: event.id,
          title: event.summary,
          start: event.start.dateTime ?? event.start.date!,
          end: event.end.dateTime ?? event.end.date!,
          ...(event.htmlLink ? { link: event.htmlLink } : {}),
        }));
      const fetchedAt = current.toISOString();
      this.lastGood = {
        fetchedAt,
        expiresAt: current.getTime() + this.ttlMs,
        events,
      };
      return { status: "available", freshness: "fresh", fetchedAt, events };
    } catch (error) {
      if (!(error instanceof ProviderFailure) && !(error instanceof z.ZodError))
        throw error;
      if (this.lastGood) {
        return {
          status: "available",
          freshness: "stale",
          fetchedAt: this.lastGood.fetchedAt,
          events: this.lastGood.events,
        };
      }
      return { status: "unavailable", code: "calendar_unavailable" };
    }
  }
}

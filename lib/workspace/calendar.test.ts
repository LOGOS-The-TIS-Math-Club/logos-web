import { describe, expect, test, vi } from "vitest";

import {
  CalendarService,
  GoogleCalendarProvider,
  type CalendarProvider,
} from "./calendar.server";
import { ProviderFailure } from "./provider.server";

const eventResponse = {
  items: [
    {
      id: "event-1",
      summary: "Synthetic meeting",
      htmlLink: "https://calendar.google.com/calendar/event?eid=test",
      start: { dateTime: "2026-09-02T08:00:00+09:00" },
      end: { dateTime: "2026-09-02T09:00:00+09:00" },
    },
  ],
};

describe("CalendarService", () => {
  test("uses a bounded read-only event-list projection", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ items: [] }), { status: 200 }),
      );
    const provider = new GoogleCalendarProvider(
      "test-calendar@group.calendar.google.com",
      { getAccessToken: vi.fn().mockResolvedValue("controlled") },
      1000,
      fetcher,
      () => new Date("2026-09-01T00:00:00Z"),
    );
    await provider.list(AbortSignal.timeout(1000));
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get("singleEvents")).toBe("true");
    expect(url.searchParams.get("maxResults")).toBe("100");
    expect(url.searchParams.get("timeMin")).toBe("2026-09-01T00:00:00.000Z");
    expect(url.searchParams.get("timeMax")).toBe("2027-09-02T00:00:00.000Z");
    expect(fetcher.mock.calls[0][1]?.method).toBeUndefined();
  });

  test("refreshes, caches, and preserves the freshness timestamp", async () => {
    const provider: CalendarProvider = {
      list: vi.fn().mockResolvedValue(eventResponse),
    };
    const service = new CalendarService(
      provider,
      60_000,
      () => new Date("2026-09-01T00:00:00Z"),
    );
    const first = await service.list();
    const cached = await service.list();
    expect(first).toMatchObject({
      status: "available",
      freshness: "fresh",
      fetchedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(cached).toEqual(first);
    expect(provider.list).toHaveBeenCalledTimes(1);
  });

  test("returns explicit stale fallback after timeout/provider failure", async () => {
    let now = new Date("2026-09-01T00:00:00Z");
    const provider: CalendarProvider = {
      list: vi
        .fn()
        .mockResolvedValueOnce(eventResponse)
        .mockRejectedValueOnce(new ProviderFailure("provider_timeout", true)),
    };
    const service = new CalendarService(provider, 1, () => now);
    await service.list();
    now = new Date("2026-09-01T00:01:00Z");
    expect(await service.list()).toMatchObject({
      status: "available",
      freshness: "stale",
      fetchedAt: "2026-09-01T00:00:00.000Z",
    });
  });

  test("returns unavailable with an empty cache and rejects invalid responses safely", async () => {
    const failure = new CalendarService({
      list: vi
        .fn()
        .mockRejectedValue(new ProviderFailure("provider_transient", true)),
    });
    const invalid = new CalendarService({
      list: vi.fn().mockResolvedValue({ items: [{ id: "bad" }] }),
    });
    await expect(failure.list()).resolves.toEqual({
      status: "unavailable",
      code: "calendar_unavailable",
    });
    await expect(invalid.list()).resolves.toEqual({
      status: "unavailable",
      code: "calendar_unavailable",
    });
  });
});

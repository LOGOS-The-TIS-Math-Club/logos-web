import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";

import {
  CORRELATION_HEADER_NAME,
  CORRELATION_HEADER_NAME_CANONICAL,
} from "../../lib/security/correlation";
import { GET } from "./route";

describe("Health Route Handler", () => {
  it("returns status ok with no-store cache control and propagates correlation ID", async () => {
    const correlationId = "12345678-1234-4234-8234-1234567890ab";
    const request = new NextRequest(new URL("http://localhost:3000/health"), {
      headers: {
        [CORRELATION_HEADER_NAME]: correlationId,
      },
    });

    const response = GET(request);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ status: "ok" });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get(CORRELATION_HEADER_NAME_CANONICAL)).toBe(
      correlationId,
    );
  });

  it("generates a valid fallback correlation ID if header is absent", async () => {
    const request = new NextRequest(new URL("http://localhost:3000/health"));

    const response = GET(request);

    expect(response.status).toBe(200);
    const headerVal = response.headers.get(CORRELATION_HEADER_NAME_CANONICAL);
    expect(headerVal).toBeTruthy();
    expect(headerVal).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });
});

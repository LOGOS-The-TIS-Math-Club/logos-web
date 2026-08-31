import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  CORRELATION_HEADER_NAME_CANONICAL,
  generateCorrelationId,
  getCorrelationId,
} from "../../lib/security/correlation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: NextRequest) {
  // Use correlation ID established by proxy middleware, or generate fresh fallback
  const correlationId =
    getCorrelationId(request.headers) ?? generateCorrelationId();

  return NextResponse.json(
    { status: "ok" },
    {
      headers: {
        "Cache-Control": "no-store",
        [CORRELATION_HEADER_NAME_CANONICAL]: correlationId,
      },
    },
  );
}

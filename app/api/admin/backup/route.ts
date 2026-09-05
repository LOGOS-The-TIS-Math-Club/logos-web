import { timingSafeEqual } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

import { runDriveBackup } from "@/lib/export/backup.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

/*
 * The scheduled Drive backup.
 *
 * Runs with no signed-in user, so the shared secret is the whole of the
 * authorization. That makes the checks below load-bearing rather than
 * defensive.
 */

export const dynamic = "force-dynamic";

/** Compares in constant time, and only for equal-length inputs. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // expected length through the error path.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  const expected = process.env.BACKUP_CRON_SECRET?.trim();

  /*
   * Fails closed. An unset or short secret disables the endpoint rather than
   * leaving it open: this route can read every record the club holds, so
   * "misconfigured" must never mean "unprotected".
   */
  if (!expected || expected.length < 32) {
    return NextResponse.json(
      {
        code: "NOT_CONFIGURED",
        message: "Scheduled backup is not configured.",
      },
      { status: 503 },
    );
  }

  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  if (!provided || !secretMatches(provided, expected)) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Invalid backup credentials." },
      { status: 401 },
    );
  }

  try {
    const results = await runDriveBackup();
    const failed = results.filter((result) => result.error);

    return NextResponse.json(
      {
        success: failed.length === 0,
        uploaded: results.length - failed.length,
        // Datasets are attempted independently, so a partial backup reports
        // which parts are missing rather than looking like a clean run.
        failures: failed.map((result) => ({
          dataset: result.dataset,
          error: result.error,
        })),
      },
      { status: failed.length === 0 ? 200 : 207 },
    );
  } catch {
    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

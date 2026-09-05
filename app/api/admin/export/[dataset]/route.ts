import { type NextRequest, NextResponse } from "next/server";

import { AccessDeniedError } from "@/lib/auth/identity-access.server";
import { DATASET_LABELS, isExportDataset } from "@/lib/export/datasets";
import { exportDatasetCsv } from "@/lib/export/service.server";
import { CORRELATION_HEADER_NAME_CANONICAL } from "@/lib/security/correlation";
import { createSafeErrorResponse } from "@/lib/security/errors";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ dataset: string }> },
) {
  const { dataset } = await context.params;
  const correlationId =
    request.headers.get(CORRELATION_HEADER_NAME_CANONICAL) ||
    crypto.randomUUID();

  // Checked against the allow-list before anything else: the value reaches the
  // filename below, and an unvalidated path segment there is a header
  // injection waiting to happen.
  if (!isExportDataset(dataset)) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: "Unknown dataset." },
      { status: 404 },
    );
  }

  try {
    const csv = await exportDatasetCsv(dataset, correlationId);
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="logos-${DATASET_LABELS[dataset]}-${stamp}.csv"`,
        // These are student records. They must not sit in a shared cache.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "You do not have permission to export club data.",
        },
        { status: 403 },
      );
    }

    return createSafeErrorResponse("INTERNAL_SERVER_ERROR", 500, correlationId);
  }
}

import { type NextRequest, NextResponse } from "next/server";

import { exportApplicationsCsvData } from "@/lib/applications/service.server";
import { AccessDeniedError } from "@/lib/auth/errors";

export async function GET(request: NextRequest) {
  const correlationId =
    request.headers.get("x-correlation-id") || crypto.randomUUID();

  try {
    const csvContent = await exportApplicationsCsvData(correlationId);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="logos-applications-${dateStr}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "FORBIDDEN",
          message: "Application export capability required",
        },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { code: "SERVER_ERROR", message: "Failed to generate export" },
      { status: 500 },
    );
  }
}

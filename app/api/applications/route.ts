import { type NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

import {
  DuplicateApplicationError,
  submitStudentApplication,
  UnverifiedAffiliationError,
} from "@/lib/applications/service.server";
import { AccessDeniedError } from "@/lib/auth/errors";
import { withDatabase } from "@/lib/db/client.server";
import {
  checkRateLimit,
  FORM_SUBMISSION_POLICY,
} from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  const correlationId =
    request.headers.get("x-correlation-id") || crypto.randomUUID();

  // Rate Limiting by client IP
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "127.0.0.1";

  try {
    const rateLimitResult = await withDatabase((database) =>
      checkRateLimit({
        db: database,
        policy: FORM_SUBMISSION_POLICY,
        rawIdentifier: clientIp,
      }),
    );

    if (!rateLimitResult.success) {
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          message: "Too many submission attempts. Please try again later.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimitResult.retryAfterSeconds),
          },
        },
      );
    }
  } catch {
    // If rate limit secret is unset in development/tests, continue gracefully
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_JSON", message: "Invalid request payload" },
      { status: 400 },
    );
  }

  try {
    const application = await submitStudentApplication(
      body as Parameters<typeof submitStudentApplication>[0],
      correlationId,
    );
    return NextResponse.json({
      success: true,
      applicationId: application.id,
      status: application.status,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          code: "VALIDATION_FAILED",
          message: "Please check your application entries",
          errors: error.issues.map((i) => ({
            field: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    if (error instanceof DuplicateApplicationError) {
      return NextResponse.json(
        {
          code: "DUPLICATE_APPLICATION",
          message:
            "An application has already been submitted for your verified Google identity",
          applicationId: error.applicationId,
        },
        { status: 409 },
      );
    }

    if (error instanceof UnverifiedAffiliationError) {
      return NextResponse.json(
        {
          code: "UNVERIFIED_AFFILIATION",
          message:
            "Applying to LOGOS requires a verified @tokyois.com account affiliation",
        },
        { status: 403 },
      );
    }

    if (error instanceof AccessDeniedError) {
      return NextResponse.json(
        {
          code: "ACCESS_DENIED",
          message: "You must sign in with a verified account to apply",
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        code: "SERVER_ERROR",
        message:
          "Unable to process application at this time. Please try again.",
      },
      { status: 500 },
    );
  }
}

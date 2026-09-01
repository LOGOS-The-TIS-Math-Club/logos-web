import { headers } from "next/headers";

import {
  AccessDeniedError,
  requireCapability,
} from "@/lib/auth/identity-access.server";
import { listWarnings } from "@/lib/attendance/service.server";
import { listMembers } from "@/lib/membership/service.server";
import { WarningsAdminView } from "./warnings-admin-view";

export const dynamic = "force-dynamic";

export default async function AdminWarningsPage() {
  const requestHeaders = await headers();
  const correlationId =
    requestHeaders.get("x-correlation-id") || crypto.randomUUID();

  let warnings = null;
  let members = [];
  let accessDenied = false;
  let serviceError = false;

  try {
    await requireCapability("warning:manage", correlationId);
    warnings = await listWarnings();
    members = await listMembers(correlationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      accessDenied = true;
    } else {
      serviceError = true;
    }
  }

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <div className="border-danger bg-danger-surface rounded-component space-y-3 border p-8">
          <h1 className="text-danger text-xl font-bold">403 • Access Denied</h1>
          <p className="text-foreground text-sm leading-relaxed">
            You do not have the required <code>warning:manage</code>{" "}
            capability to manage warning records.
          </p>
          <p className="text-muted-foreground text-xs">
            Warning management is restricted to authorized club operators.
          </p>
        </div>
      </div>
    );
  }

  if (serviceError || !warnings) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <div className="border-border bg-surface rounded-component space-y-3 border p-8">
          <h1 className="text-foreground text-xl font-bold">
            Service Unavailable
          </h1>
          <p className="text-muted-foreground text-sm">
            Unable to retrieve warning records. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return <WarningsAdminView initialWarnings={warnings} members={members} />;
}

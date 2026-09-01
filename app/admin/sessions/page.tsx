import { headers } from "next/headers";

import {
  AccessDeniedError,
  requireCapability,
} from "@/lib/auth/identity-access.server";
import { listClubSessions } from "@/lib/attendance/service.server";
import { SessionAdminView } from "./session-admin-view";

export const dynamic = "force-dynamic";

export default async function AdminSessionsPage() {
  const requestHeaders = await headers();
  const correlationId =
    requestHeaders.get("x-correlation-id") || crypto.randomUUID();

  let sessions = null;
  let accessDenied = false;
  let serviceError = false;

  try {
    await requireCapability("session:manage", correlationId);
    sessions = await listClubSessions();
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
            You do not have the required <code>session:manage</code>{" "}
            capability to manage club sessions.
          </p>
          <p className="text-muted-foreground text-xs">
            Session management is restricted to authorized club operators.
          </p>
        </div>
      </div>
    );
  }

  if (serviceError || !sessions) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <div className="border-border bg-surface rounded-component space-y-3 border p-8">
          <h1 className="text-foreground text-xl font-bold">
            Service Unavailable
          </h1>
          <p className="text-muted-foreground text-sm">
            Unable to retrieve club sessions. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return <SessionAdminView initialSessions={sessions} />;
}

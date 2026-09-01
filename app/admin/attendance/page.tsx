import { headers } from "next/headers";

import {
  AccessDeniedError,
  requireCapability,
} from "@/lib/auth/identity-access.server";
import {
  getSessionAttendance,
  listClubSessions,
} from "@/lib/attendance/service.server";
import { type MemberSessionAttendance } from "@/lib/attendance/schema";
import { AttendanceAdminView } from "./attendance-admin-view";

export const dynamic = "force-dynamic";

export default async function AdminAttendancePage(props: {
  searchParams: Promise<{ sessionId?: string }>;
}) {
  const searchParams = await props.searchParams;
  const requestHeaders = await headers();
  const correlationId =
    requestHeaders.get("x-correlation-id") || crypto.randomUUID();

  let sessions = null;
  let targetSessionId = searchParams.sessionId || "";
  let roster: MemberSessionAttendance[] = [];
  let accessDenied = false;
  let serviceError = false;

  try {
    await requireCapability("attendance:record", correlationId);
    sessions = await listClubSessions();

    if (sessions.length > 0) {
      if (!targetSessionId || !sessions.some((s) => s.id === targetSessionId)) {
        targetSessionId = sessions[0].id;
      }
      const data = await getSessionAttendance(targetSessionId);
      roster = data.roster;
    }
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
            You do not have the required <code>attendance:record</code>{" "}
            capability to mark or view attendance.
          </p>
          <p className="text-muted-foreground text-xs">
            Attendance operations are restricted to authorized club operators.
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
            Unable to retrieve attendance ledger. Please try again later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AttendanceAdminView
      sessions={sessions}
      initialSelectedSessionId={targetSessionId}
      initialRoster={roster}
    />
  );
}

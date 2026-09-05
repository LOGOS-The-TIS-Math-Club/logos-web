import Link from "next/link";
import { headers } from "next/headers";

import {
  AccessDeniedError,
  requireCapability,
} from "@/lib/auth/identity-access.server";
import {
  getMemberAttendanceDetail,
  MemberAttendanceNotFoundError,
} from "@/lib/attendance/service.server";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  present: "Present",
  late: "Late",
  excused_absence: "Excused",
  unexcused_absence: "Unexcused",
  unmarked: "Not marked",
};

const STATUS_CLASS: Record<string, string> = {
  present: "border-success/30 bg-success-surface text-success",
  late: "border-warning/30 bg-warning-surface text-warning",
  excused_absence: "border-border bg-surface-raised text-muted-foreground",
  unexcused_absence: "border-danger/30 bg-danger-surface text-danger",
  unmarked: "border-border bg-surface text-subtle-foreground",
};

export default async function MemberAttendancePage(context: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await context.params;
  const requestHeaders = await headers();
  const correlationId =
    requestHeaders.get("x-correlation-id") || crypto.randomUUID();

  let detail = null;
  let accessDenied = false;
  let notFound = false;

  try {
    await requireCapability("membership:read", correlationId);
    detail = await getMemberAttendanceDetail(id, correlationId);
  } catch (error) {
    if (error instanceof AccessDeniedError) accessDenied = true;
    else if (error instanceof MemberAttendanceNotFoundError) notFound = true;
    else throw error;
  }

  if (accessDenied) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <div className="border-danger bg-danger-surface rounded-component space-y-3 border p-8">
          <h1 className="text-danger text-xl font-bold">403 • Access Denied</h1>
          <p className="text-foreground text-sm leading-relaxed">
            You do not have the required <code>membership:read</code> capability
            to view member attendance.
          </p>
        </div>
      </div>
    );
  }

  if (notFound || !detail) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-12 text-center">
        <div className="panel space-y-3 p-8">
          <h1 className="heading-3">Member not found</h1>
          <Link href="/admin/members" className="text-primary text-sm">
            Back to the roster
          </Link>
        </div>
      </div>
    );
  }

  const { totals } = detail;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/admin/members"
          className="text-muted-foreground hover:text-foreground text-xs font-semibold"
        >
          ← Roster
        </Link>
        <h1 className="heading-1">{detail.rosterName}</h1>
        <p className="text-muted-foreground text-sm">{detail.email}</p>
      </div>

      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        {[
          ["Attendance", `${totals.attendanceRate}%`],
          ["Present", totals.presentCount],
          ["Late", totals.lateCount],
          ["Excused", totals.excusedCount],
          ["Unexcused", totals.unexcusedCount],
        ].map(([label, value]) => (
          <div key={label} className="panel p-4">
            <dt className="text-subtle-foreground text-xs font-medium">
              {label}
            </dt>
            <dd className="text-foreground mt-1 text-2xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="history-heading" className="space-y-3">
        <h2 id="history-heading" className="heading-3">
          Session history
        </h2>

        {detail.rows.length === 0 ? (
          <div className="panel py-10 text-center">
            <p className="text-muted-foreground text-sm">
              No sessions have been created yet.
            </p>
          </div>
        ) : (
          <div className="panel overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-subtle-foreground border-border border-b">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Session
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-4 py-3 font-medium">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {detail.rows.map((row) => (
                  <tr
                    key={row.sessionId}
                    className="hover:bg-surface-raised/50"
                  >
                    <td className="datum text-muted-foreground px-4 py-3 whitespace-nowrap">
                      {row.sessionDate}
                    </td>
                    <td className="text-foreground px-4 py-3">{row.title}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                          STATUS_CLASS[row.status] ?? STATUS_CLASS.unmarked
                        }`}
                      >
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="text-muted-foreground px-4 py-3">
                      {row.absenceReason ? (
                        <span>
                          Notice filed
                          {row.absenceStatus
                            ? ` (${row.absenceStatus})`
                            : ""}: {row.absenceReason}
                        </span>
                      ) : (
                        (row.notes ?? "—")
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

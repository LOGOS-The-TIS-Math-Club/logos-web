"use client";

import { useId, useState } from "react";
import {
  type ApplicationStatus,
  MATH_COURSES,
} from "@/lib/applications/schema";
import {
  StatusBadge,
  type StatusBadgeVariant,
} from "@/components/ui/status-badge";

export interface ApplicationAdminItem {
  id: string;
  identityId: string;
  email: string;
  preferredName: string;
  grade: string;
  academicInterests: string[];
  mathCourse: string | null;
  contestInterest: string | null;
  presentInterest: string | null;
  attendanceConfirmation: string;
  status: ApplicationStatus;
  statusReason: string | null;
  submittedAt: string | Date;
  statusUpdatedAt: string | Date;
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ""
  );
}

const statusBadgeMap: Record<ApplicationStatus, StatusBadgeVariant> = {
  submitted: "info",
  reviewing: "warning",
  accepted: "success",
  declined: "neutral",
};

/** Short labels for the shared yes / maybe / no scale. */
const SCALE_LABELS: Record<string, string> = {
  yes: "Yes",
  maybe: "Maybe",
  no: "No",
};

export function ApplicationAdminView({
  initialApplications,
}: {
  initialApplications: ApplicationAdminItem[];
}) {
  const [applications, setApplications] =
    useState<ApplicationAdminItem[]>(initialApplications);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateStatusVal, setUpdateStatusVal] =
    useState<ApplicationStatus>("submitted");
  const [updateReasonVal, setUpdateReasonVal] = useState("");
  const [actionMessage, setActionMessage] = useState<{
    id: string;
    text: string;
    type: "success" | "error";
  } | null>(null);

  const filterId = useId();

  const counts = {
    all: applications.length,
    submitted: applications.filter((a) => a.status === "submitted").length,
    reviewing: applications.filter((a) => a.status === "reviewing").length,
    accepted: applications.filter((a) => a.status === "accepted").length,
    declined: applications.filter((a) => a.status === "declined").length,
  };

  const filtered =
    selectedStatus === "all"
      ? applications
      : applications.filter((a) => a.status === selectedStatus);

  const activeApp = applications.find((a) => a.id === activeAppId);

  const handleOpenDetail = (app: ApplicationAdminItem) => {
    setActiveAppId(app.id);
    setUpdateStatusVal(app.status);
    setUpdateReasonVal(app.statusReason ?? "");
    setActionMessage(null);
  };

  const handleStatusUpdate = async (applicationId: string) => {
    setUpdatingId(applicationId);
    setActionMessage(null);

    try {
      const csrfToken = decodeURIComponent(getCookie("__Host-logos_csrf"));
      const sessionCsrfToken = decodeURIComponent(
        getCookie("__Host-logos_session_csrf"),
      );

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      if (sessionCsrfToken) headers["X-Session-CSRF-Token"] = sessionCsrfToken;

      const response = await fetch("/api/admin/applications/status", {
        method: "POST",
        headers,
        body: JSON.stringify({
          applicationId,
          status: updateStatusVal,
          statusReason: updateReasonVal.trim() || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setActionMessage({
          id: applicationId,
          text: result.message || "Failed to update status",
          type: "error",
        });
        setUpdatingId(null);
        return;
      }

      setApplications((prev) =>
        prev.map((app) =>
          app.id === applicationId
            ? {
                ...app,
                status: updateStatusVal,
                statusReason: updateReasonVal.trim() || null,
                statusUpdatedAt: new Date(),
              }
            : app,
        ),
      );

      setActionMessage({
        id: applicationId,
        text: `Status updated to ${updateStatusVal.toUpperCase()}`,
        type: "success",
      });
    } catch {
      setActionMessage({
        id: applicationId,
        text: "Network error occurred",
        type: "error",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header & Export Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Applicant Review
          </h1>
          <p className="text-muted-foreground text-sm">
            Manage, evaluate, and export student applications for LOGOS.
          </p>
        </div>

        <div>
          <a href="/api/admin/applications/export" download className="control">
            Export Applications (CSV)
          </a>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="panel flex flex-wrap gap-2 p-1.5">
        {(
          ["all", "submitted", "reviewing", "accepted", "declined"] as const
        ).map((statusKey) => {
          const isActive = selectedStatus === statusKey;
          const count = counts[statusKey];
          const label =
            statusKey === "all"
              ? "All"
              : statusKey.charAt(0).toUpperCase() + statusKey.slice(1);

          return (
            <button
              key={statusKey}
              type="button"
              onClick={() => setSelectedStatus(statusKey)}
              className={`rounded-component focus-visible:outline-focus flex min-h-11 items-center gap-2 px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                isActive
                  ? "bg-surface-raised text-primary border-primary border"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-raised"
              }`}
            >
              <span>{label}</span>
              <span
                className={`py-0.2 rounded-full px-1.5 text-[10px] ${
                  isActive
                    ? "bg-primary text-primary-foreground font-bold"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Applications List & Detail Split View */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Applications List */}
        <section
          aria-labelledby="app-list-heading"
          className="space-y-4 lg:col-span-7"
        >
          <h2 id="app-list-heading" className="sr-only">
            Applications List
          </h2>

          {filtered.length === 0 ? (
            <div className="panel p-8 text-center">
              <p className="text-muted-foreground text-sm">
                No applications matching filter{" "}
                <strong>{selectedStatus}</strong>.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((app) => {
                const isSelected = activeAppId === app.id;
                const dateStr = new Date(app.submittedAt).toLocaleDateString(
                  "en-US",
                  { month: "short", day: "numeric", year: "numeric" },
                );

                return (
                  <div
                    key={app.id}
                    className={`border-border rounded-component cursor-pointer border p-4 transition-colors ${
                      isSelected
                        ? "border-primary bg-surface-raised"
                        : "bg-surface hover:bg-surface-raised"
                    }`}
                    onClick={() => handleOpenDetail(app)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleOpenDetail(app);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`View application for ${app.preferredName}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-foreground text-sm font-semibold">
                            {app.preferredName}
                          </p>
                          <span className="text-muted-foreground text-xs">
                            •
                          </span>
                          <span className="text-muted-foreground text-xs font-medium">
                            {app.grade}
                          </span>
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {app.email}
                        </p>
                      </div>
                      <StatusBadge variant={statusBadgeMap[app.status]}>
                        {app.status.toUpperCase()}
                      </StatusBadge>
                    </div>

                    <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
                      <span className="max-w-[240px] truncate">
                        {Array.isArray(app.academicInterests)
                          ? app.academicInterests.join(", ")
                          : app.academicInterests}
                      </span>
                      <span>{dateStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Selected Application Detail Panel */}
        <section aria-labelledby="app-detail-heading" className="lg:col-span-5">
          <div className="panel sticky top-6 space-y-6 p-6">
            <h2
              id="app-detail-heading"
              className="text-foreground border-border border-b pb-3 text-base font-semibold"
            >
              Application Details
            </h2>

            {activeApp ? (
              <div className="space-y-6 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-foreground text-lg font-bold">
                      {activeApp.preferredName}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {activeApp.email} • {activeApp.grade}
                    </p>
                  </div>
                  <StatusBadge variant={statusBadgeMap[activeApp.status]}>
                    {activeApp.status.toUpperCase()}
                  </StatusBadge>
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <p className="text-muted-foreground font-semibold">
                      Interests
                    </p>
                    <p className="text-foreground mt-0.5">
                      {Array.isArray(activeApp.academicInterests)
                        ? activeApp.academicInterests.join(", ")
                        : activeApp.academicInterests}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground font-semibold">
                      Maths Course
                    </p>
                    <p className="text-foreground mt-0.5">
                      {activeApp.mathCourse
                        ? (MATH_COURSES.find(
                            (course) => course.key === activeApp.mathCourse,
                          )?.label ?? activeApp.mathCourse)
                        : "Not shared"}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground font-semibold">
                      In-club Contests
                    </p>
                    <p className="text-foreground mt-0.5">
                      {SCALE_LABELS[activeApp.contestInterest ?? ""] ??
                        "Not answered"}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground font-semibold">
                      Presenting
                    </p>
                    <p className="text-foreground mt-0.5">
                      {SCALE_LABELS[activeApp.presentInterest ?? ""] ??
                        "Not answered"}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground font-semibold">
                      Meeting Attendance
                    </p>
                    <p className="text-foreground mt-0.5">
                      {activeApp.attendanceConfirmation === "regular"
                        ? "Regular Friday attendance"
                        : activeApp.attendanceConfirmation ===
                            "occasional_conflicts"
                          ? "Occasional known conflicts"
                          : "Ongoing conflict"}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground font-semibold">
                      Submitted At
                    </p>
                    <p className="text-foreground mt-0.5">
                      {new Date(activeApp.submittedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Status Update Control */}
                <div className="panel-raised space-y-3 p-4">
                  <h4 className="text-foreground text-xs font-semibold">
                    Update Application Status
                  </h4>

                  <div className="space-y-2">
                    <label htmlFor={`${filterId}-status`} className="sr-only">
                      Select new status
                    </label>
                    <select
                      id={`${filterId}-status`}
                      value={updateStatusVal}
                      onChange={(e) =>
                        setUpdateStatusVal(e.target.value as ApplicationStatus)
                      }
                      className="field-input"
                    >
                      <option value="submitted">Submitted</option>
                      <option value="reviewing">Reviewing</option>
                      <option value="accepted">Accepted</option>
                      <option value="declined">Declined</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Optional status note / reason (max 256 chars)"
                      maxLength={256}
                      value={updateReasonVal}
                      onChange={(e) => setUpdateReasonVal(e.target.value)}
                      className="field-input"
                    />

                    <button
                      type="button"
                      disabled={updatingId === activeApp.id}
                      onClick={() => handleStatusUpdate(activeApp.id)}
                      className="control control-primary"
                    >
                      {updatingId === activeApp.id
                        ? "Saving…"
                        : "Save Status Update"}
                    </button>
                  </div>

                  {actionMessage && actionMessage.id === activeApp.id && (
                    <p
                      role="status"
                      className={`text-xs ${
                        actionMessage.type === "success"
                          ? "text-success"
                          : "text-danger"
                      }`}
                    >
                      {actionMessage.text}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs leading-relaxed">
                Select an application from the list to view detailed answers and
                manage review status.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

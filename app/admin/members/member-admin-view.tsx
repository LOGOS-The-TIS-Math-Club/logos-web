"use client";

import Link from "next/link";

import { GRADE_OPTIONS } from "@/lib/membership/grade";

import { useId, useState } from "react";

import {
  StatusBadge,
  type StatusBadgeVariant,
} from "@/components/ui/status-badge";
import {
  type ClubMemberStatus,
  type MemberListItem,
} from "@/lib/membership/schema";

export interface AcceptedApplicationItem {
  id: string;
  identityId: string;
  preferredName: string;
  email: string;
  grade: string;
  submittedAt: string;
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

const statusBadgeMap: Record<ClubMemberStatus, StatusBadgeVariant> = {
  active: "success",
  inactive: "warning",
  former: "neutral",
};

export function MemberAdminView({
  initialMembers,
  acceptedApplications,
}: {
  initialMembers: MemberListItem[];
  acceptedApplications: AcceptedApplicationItem[];
}) {
  const [members, setMembers] = useState<MemberListItem[]>(initialMembers);
  const [pendingApps, setPendingApps] =
    useState<AcceptedApplicationItem[]>(acceptedApplications);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editingMember, setEditingMember] = useState<MemberListItem | null>(
    null,
  );
  const [editStatus, setEditStatus] = useState<ClubMemberStatus>("active");
  const [editReason, setEditReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const filterId = useId();

  const counts = {
    all: members.length,
    active: members.filter((m) => m.status === "active").length,
    inactive: members.filter((m) => m.status === "inactive").length,
    former: members.filter((m) => m.status === "former").length,
  };

  const filteredMembers =
    statusFilter === "all"
      ? members
      : members.filter((m) => m.status === statusFilter);

  const handleActivate = async (app: AcceptedApplicationItem) => {
    setActivatingId(app.id);
    setFeedback(null);

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

      const response = await fetch("/api/admin/members", {
        method: "POST",
        headers,
        body: JSON.stringify({
          applicationId: app.id,
          reason: `Deliberately activated from accepted application for ${app.preferredName}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || "Failed to activate membership",
        );
      }

      const { member } = await response.json();

      // Add to members list
      const newMemberItem: MemberListItem = {
        id: member.id,
        identityId: app.identityId,
        applicationId: app.id,
        preferredName: app.preferredName,
        // A newly activated member has neither override yet.
        rosterName: app.preferredName,
        displayName: null,
        appliedGrade: null,
        cohortYear: null,
        gradeOverride: null,
        email: app.email,
        grade: app.grade,
        status: "active",
        joinedAt: new Date().toISOString(),
        leftAt: null,
        statusReason: "Deliberately activated",
        warningCount: 0,
      };

      setMembers((prev) => [newMemberItem, ...prev]);
      setPendingApps((prev) => prev.filter((p) => p.id !== app.id));
      setFeedback({
        type: "success",
        text: `Successfully activated membership for ${app.preferredName}.`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Activation failed. Please try again.",
      });
    } finally {
      setActivatingId(null);
    }
  };

  /*
   * Leadership's own view of a member: the name they work from, and the two
   * fields behind grade progression. displayName is deliberately absent — that
   * belongs to the member, and correcting a roster should not rewrite what
   * somebody calls themselves.
   */
  const [detailsMember, setDetailsMember] = useState<MemberListItem | null>(
    null,
  );
  const [detailsRosterName, setDetailsRosterName] = useState("");
  const [detailsGradeOverride, setDetailsGradeOverride] = useState("");
  const [detailsCohortYear, setDetailsCohortYear] = useState("");
  const [savingDetails, setSavingDetails] = useState(false);

  function openDetails(member: MemberListItem) {
    setDetailsMember(member);
    setDetailsRosterName(member.rosterName);
    setDetailsGradeOverride(member.gradeOverride ?? "");
    setDetailsCohortYear(
      member.cohortYear === null ? "" : String(member.cohortYear),
    );
    setFeedback(null);
  }

  const handleDetailsSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!detailsMember) return;

    setSavingDetails(true);
    setFeedback(null);

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const csrfToken = decodeURIComponent(getCookie("__Host-logos_csrf"));
      const sessionCsrfToken = decodeURIComponent(
        getCookie("__Host-logos_session_csrf"),
      );
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      if (sessionCsrfToken) headers["X-Session-CSRF-Token"] = sessionCsrfToken;

      const response = await fetch(
        `/api/admin/members/${detailsMember.id}/metadata`,
        {
          method: "POST",
          headers,
          // Empty means "clear the override", which is a real intent and not
          // the same as leaving the field alone.
          body: JSON.stringify({
            rosterName: detailsRosterName.trim() || null,
            gradeOverride: detailsGradeOverride.trim() || null,
            cohortYear: detailsCohortYear.trim()
              ? Number(detailsCohortYear)
              : null,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.message || "Failed to save member details");
      }

      const { member: updated } = await response.json();

      setMembers((prev) =>
        prev.map((item) =>
          item.id === detailsMember.id
            ? {
                ...item,
                rosterName:
                  updated.rosterName || item.preferredName || "Member",
                gradeOverride: updated.gradeOverride,
                cohortYear: updated.cohortYear,
                // The grade shown is derived server-side, so an override is
                // reflected immediately and a cleared one falls back on the
                // next load rather than showing a stale value now.
                grade: updated.gradeOverride ?? item.grade,
              }
            : item,
        ),
      );
      setFeedback({ type: "success", text: "Member details updated." });
      setDetailsMember(null);
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not save member details.",
      });
    } finally {
      setSavingDetails(false);
    }
  };

  const handleStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    setIsSubmitting(true);
    setFeedback(null);

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

      const response = await fetch(
        `/api/admin/members/${editingMember.id}/status`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            status: editStatus,
            reason: editReason,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || "Failed to update member status",
        );
      }

      setMembers((prev) =>
        prev.map((m) =>
          m.id === editingMember.id
            ? {
                ...m,
                status: editStatus,
                statusReason: editReason || m.statusReason,
                leftAt:
                  editStatus === "active"
                    ? null
                    : m.leftAt || new Date().toISOString(),
              }
            : m,
        ),
      );

      setFeedback({
        type: "success",
        text: `Updated status for ${editingMember.preferredName} to ${editStatus}.`,
      });
      setEditingMember(null);
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Status update failed. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Subtitle */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Club Members
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage deliberate membership activations, member history, and
            operational status.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="field-input">
            {counts.active} Active {counts.active === 1 ? "Member" : "Members"}
          </span>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-component border p-4 text-sm ${
            feedback.type === "success"
              ? "border-success bg-success-surface text-success"
              : "border-danger bg-danger-surface text-danger"
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Pending Deliberate Activation Queue */}
      {pendingApps.length > 0 && (
        <div className="panel space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-base font-bold">
              Ready for Membership Activation ({pendingApps.length})
            </h2>
            <span className="text-muted-foreground text-xs">
              Accepted Applications
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            These applicants have been accepted. Membership requires a separate
            deliberate activation step.
          </p>

          <div className="divide-border divide-y">
            {pendingApps.map((app) => (
              <div
                key={app.id}
                className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm font-semibold">
                      {app.preferredName}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      ({app.grade})
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">{app.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleActivate(app)}
                  disabled={activatingId === app.id}
                  className="control control-primary"
                >
                  {activatingId === app.id
                    ? "Activating..."
                    : "Activate as Member"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="border-border flex flex-wrap items-center justify-between gap-4 border-b pb-3">
        <div className="flex items-center gap-2">
          <label
            htmlFor={filterId}
            className="text-muted-foreground text-xs font-medium"
          >
            Status:
          </label>
          <select
            id={filterId}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="field-input"
          >
            <option value="all">All Members ({counts.all})</option>
            <option value="active">Active ({counts.active})</option>
            <option value="inactive">Inactive ({counts.inactive})</option>
            <option value="former">Former ({counts.former})</option>
          </select>
        </div>
      </div>

      {/* Members Table */}
      {filteredMembers.length === 0 ? (
        <div className="panel py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No member records found matching the selected filter.
          </p>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-border bg-surface-raised text-muted-foreground border-b text-xs font-semibold">
              <tr>
                <th className="px-4 py-3">Member</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Warnings</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y text-xs">
              {filteredMembers.map((member) => (
                <tr key={member.id} className="hover:bg-surface-raised/50">
                  <td className="px-4 py-3">
                    <div className="text-foreground flex items-center gap-2 font-semibold">
                      {member.rosterName}
                      <Link
                        href={`/admin/members/${member.id}`}
                        className="text-primary hover:text-primary-hover focus-visible:outline-focus rounded text-[11px] font-medium focus-visible:outline-1"
                      >
                        Attendance
                      </Link>
                      <button
                        type="button"
                        onClick={() => openDetails(member)}
                        className="text-muted-foreground hover:text-foreground focus-visible:outline-focus rounded text-[11px] font-medium focus-visible:outline-1"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="text-muted-foreground">{member.email}</div>
                    {/* Shown only when it differs, so leadership can connect
                        the roster name to whoever the member calls themselves
                        without the column filling up with duplicates. */}
                    {member.displayName &&
                    member.displayName !== member.rosterName ? (
                      <div className="text-subtle-foreground mt-0.5 text-[11px]">
                        goes by “{member.displayName}”
                      </div>
                    ) : null}
                  </td>
                  <td className="text-foreground px-4 py-3">
                    {member.grade || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={statusBadgeMap[member.status]}>
                      {member.status.charAt(0).toUpperCase() +
                        member.status.slice(1)}
                    </StatusBadge>
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {member.warningCount > 0 ? (
                      <span className="border-danger/30 bg-danger-surface text-danger inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold">
                        {member.warningCount}{" "}
                        {member.warningCount === 1 ? "warning" : "warnings"}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMember(member);
                        setEditStatus(member.status);
                        setEditReason(member.statusReason || "");
                      }}
                      className="control"
                    >
                      Update Status
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Status Modal */}
      {editingMember && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-status-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="panel w-full max-w-md space-y-4 p-6 shadow-xl">
            <h2
              id="edit-status-title"
              className="text-foreground text-lg font-bold"
            >
              Update Member Status
            </h2>
            <p className="text-muted-foreground text-xs">
              Updating status for{" "}
              <strong className="text-foreground">
                {editingMember.preferredName}
              </strong>{" "}
              ({editingMember.email}).
            </p>

            <form onSubmit={handleStatusUpdate} className="space-y-4">
              <div>
                <label className="text-foreground block text-xs font-medium">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as ClubMemberStatus)
                  }
                  className="field-input"
                >
                  <option value="active">
                    Active (current participating member)
                  </option>
                  <option value="inactive">
                    Inactive (temporarily paused)
                  </option>
                  <option value="former">
                    Former (graduated or left club)
                  </option>
                </select>
              </div>

              <div>
                <label className="text-foreground block text-xs font-medium">
                  Reason / Notes
                </label>
                <textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  maxLength={256}
                  placeholder="e.g. Schedule conflict for semester, graduation, etc."
                  rows={3}
                  className="panel text-foreground focus:ring-primary mt-1 w-full p-2 text-xs focus:ring-1 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  disabled={isSubmitting}
                  className="control"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="control control-primary"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailsMember && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="member-details-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="panel w-full max-w-lg space-y-4 p-6 shadow-xl">
            <h2 id="member-details-title" className="heading-3">
              Edit member details
            </h2>
            <p className="text-muted-foreground text-xs">
              {detailsMember.email}
            </p>

            <form onSubmit={handleDetailsSave} className="space-y-4">
              <div>
                <label
                  htmlFor="details-roster-name"
                  className="text-foreground block text-xs font-medium"
                >
                  Roster name
                </label>
                <input
                  id="details-roster-name"
                  type="text"
                  maxLength={80}
                  value={detailsRosterName}
                  onChange={(e) => setDetailsRosterName(e.target.value)}
                  className="field-input"
                />
                <p className="text-subtle-foreground mt-1 text-xs">
                  What leadership sees. Leave empty to use the name on their
                  application. This does not change the name the member chose
                  for themselves.
                </p>
              </div>

              <div>
                <label
                  htmlFor="details-cohort-year"
                  className="text-foreground block text-xs font-medium"
                >
                  Cohort year
                </label>
                <input
                  id="details-cohort-year"
                  type="number"
                  min={2000}
                  max={2100}
                  placeholder="2026"
                  value={detailsCohortYear}
                  onChange={(e) => setDetailsCohortYear(e.target.value)}
                  className="field-input"
                />
                <p className="text-subtle-foreground mt-1 text-xs">
                  The school year they were in{" "}
                  {detailsMember.appliedGrade ?? "the grade they applied as"}.
                  Grades move up automatically each 1 August from this year.
                </p>
              </div>

              <div>
                <label
                  htmlFor="details-grade-override"
                  className="text-foreground block text-xs font-medium"
                >
                  Grade override
                </label>
                <select
                  id="details-grade-override"
                  value={detailsGradeOverride}
                  onChange={(e) => setDetailsGradeOverride(e.target.value)}
                  className="field-input"
                >
                  <option value="">
                    Automatic ({detailsMember.grade ?? "unknown"})
                  </option>
                  {GRADE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <p className="text-subtle-foreground mt-1 text-xs">
                  Only needed when the automatic progression is wrong — a
                  repeated year, a skipped year, or a mid-year transfer.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDetailsMember(null)}
                  disabled={savingDetails}
                  className="control"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingDetails}
                  className="control control-primary"
                >
                  {savingDetails ? "Saving…" : "Save details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

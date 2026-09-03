"use client";

import { useId, useState } from "react";

import { type MemberListItem } from "@/lib/membership/schema";
import { type WarningListItem } from "@/lib/attendance/schema";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ""
  );
}

export function WarningsAdminView({
  initialWarnings,
  members,
}: {
  initialWarnings: WarningListItem[];
  members: MemberListItem[];
}) {
  const [warnings, setWarnings] = useState<WarningListItem[]>(initialWarnings);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(
    members[0]?.id || "",
  );
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const memberSelectId = useId();
  const reasonId = useId();
  const notesId = useId();

  const activeWarnings = warnings.filter((w) => w.active);
  const resolvedWarnings = warnings.filter((w) => !w.active);

  const handleIssueWarning = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberId || !reason) return;

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

      const response = await fetch("/api/admin/warnings", {
        method: "POST",
        headers,
        body: JSON.stringify({
          memberId: selectedMemberId,
          reason,
          notes: notes || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || "Failed to issue warning");
      }

      const { warning } = await response.json();
      const member = members.find((m) => m.id === selectedMemberId);

      const newWarningItem: WarningListItem = {
        id: warning.id,
        memberId: selectedMemberId,
        memberName: member?.preferredName || "Member",
        memberEmail: member?.email || "",
        reason: warning.reason,
        notes: warning.notes,
        active: true,
        issuedAt: new Date().toISOString(),
        resolvedAt: null,
      };

      setWarnings((prev) => [newWarningItem, ...prev]);
      setFeedback({
        type: "success",
        text: `Issued manual warning to ${member?.preferredName}.`,
      });
      setShowIssueModal(false);
      setReason("");
      setNotes("");
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to issue warning.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveWarning = async (warningId: string) => {
    setResolvingId(warningId);
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

      const response = await fetch("/api/admin/warnings", {
        method: "PATCH",
        headers,
        body: JSON.stringify({ warningId }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || "Failed to resolve warning",
        );
      }

      setWarnings((prev) =>
        prev.map((w) =>
          w.id === warningId
            ? { ...w, active: false, resolvedAt: new Date().toISOString() }
            : w,
        ),
      );

      setFeedback({
        type: "success",
        text: "Warning marked as resolved.",
      });
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to resolve warning.",
      });
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Issue Button */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Manual Warnings
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Record and review deliberate leadership warnings. No automated
            scoring or punishment engines.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowIssueModal(true)}
            disabled={members.length === 0}
            className="bg-danger text-danger-foreground rounded-component focus-visible:outline-focus inline-flex min-h-10 items-center justify-center px-4 py-2 text-xs font-semibold transition-colors hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
          >
            + Issue Manual Warning
          </button>
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

      {/* Active Warnings Section */}
      <div className="space-y-4">
        <h2 className="text-foreground text-base font-bold">
          Active Warnings ({activeWarnings.length})
        </h2>

        {activeWarnings.length === 0 ? (
          <div className="panel py-8 text-center">
            <p className="text-muted-foreground text-xs">
              No active warnings currently recorded.
            </p>
          </div>
        ) : (
          <div className="panel divide-border divide-y">
            {activeWarnings.map((w) => (
              <div
                key={w.id}
                className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm font-semibold">
                      {w.memberName}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      ({w.memberEmail})
                    </span>
                  </div>
                  <p className="text-danger text-xs font-medium">{w.reason}</p>
                  {w.notes && (
                    <p className="text-muted-foreground text-xs italic">
                      Note: {w.notes}
                    </p>
                  )}
                  <p className="text-muted-foreground text-[10px]">
                    Issued: {new Date(w.issuedAt).toLocaleDateString()}
                  </p>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={() => handleResolveWarning(w.id)}
                    disabled={resolvingId === w.id}
                    className="control"
                  >
                    {resolvingId === w.id ? "Resolving..." : "Mark Resolved"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Resolved Warnings History */}
      {resolvedWarnings.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-muted-foreground text-sm font-semibold">
            Resolved Warnings History ({resolvedWarnings.length})
          </h2>
          <div className="divide-border rounded-component border-border bg-surface/50 divide-y border">
            {resolvedWarnings.map((w) => (
              <div key={w.id} className="p-4 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-foreground font-semibold">
                    {w.memberName} ({w.memberEmail})
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    Resolved on{" "}
                    {w.resolvedAt &&
                      new Date(w.resolvedAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1">{w.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issue Warning Modal */}
      {showIssueModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="issue-warning-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="panel w-full max-w-md space-y-4 p-6 shadow-xl">
            <h2
              id="issue-warning-title"
              className="text-foreground text-lg font-bold"
            >
              Issue Manual Warning
            </h2>
            <p className="text-muted-foreground text-xs">
              Record a deliberate manual warning with a bounded reason. All
              actions are audited.
            </p>

            <form onSubmit={handleIssueWarning} className="space-y-4">
              <div>
                <label
                  htmlFor={memberSelectId}
                  className="text-foreground block text-xs font-medium"
                >
                  Select Member
                </label>
                <select
                  id={memberSelectId}
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="field-input"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.preferredName} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor={reasonId}
                  className="text-foreground block text-xs font-medium"
                >
                  Reason (1–256 characters)
                </label>
                <input
                  id={reasonId}
                  type="text"
                  required
                  maxLength={256}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. Unexcused absence for 3 consecutive meetings without notice."
                  className="field-input"
                />
              </div>

              <div>
                <label
                  htmlFor={notesId}
                  className="text-foreground block text-xs font-medium"
                >
                  Private Leadership Notes (Optional)
                </label>
                <textarea
                  id={notesId}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  placeholder="Optional context for leadership records."
                  rows={3}
                  className="panel text-foreground focus:ring-primary mt-1 w-full p-2 text-xs focus:ring-1 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowIssueModal(false)}
                  disabled={isSubmitting}
                  className="control"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-danger text-danger-foreground rounded-component px-4 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {isSubmitting ? "Issuing..." : "Issue Warning"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

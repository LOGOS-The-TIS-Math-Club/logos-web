"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  type AttendanceStatus,
  type MemberSessionAttendance,
  type SessionListItem,
} from "@/lib/attendance/schema";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ""
  );
}

export function AttendanceAdminView({
  sessions,
  initialSelectedSessionId,
  initialRoster,
}: {
  sessions: SessionListItem[];
  initialSelectedSessionId: string;
  initialRoster: MemberSessionAttendance[];
}) {
  const router = useRouter();
  const [selectedSessionId, setSelectedSessionId] = useState(
    initialSelectedSessionId,
  );
  const [roster, setRoster] =
    useState<MemberSessionAttendance[]>(initialRoster);
  const [isSaving, setIsSaving] = useState(false);
  const [showAbsenceModal, setShowAbsenceModal] = useState(false);
  const [absenceMemberId, setAbsenceMemberId] = useState(
    initialRoster[0]?.memberId || "",
  );
  const [absenceReason, setAbsenceReason] = useState("");
  const [isSubmittingAbsence, setIsSubmittingAbsence] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  // Derived counts
  const presentCount = roster.filter((r) => r.status === "present").length;
  const lateCount = roster.filter((r) => r.status === "late").length;
  const excusedCount = roster.filter(
    (r) => r.status === "excused_absence",
  ).length;
  const unexcusedCount = roster.filter(
    (r) => r.status === "unexcused_absence",
  ).length;
  const unmarkedCount = roster.filter((r) => r.status === "unmarked").length;

  const handleSessionChange = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    router.push(`/admin/attendance?sessionId=${sessionId}`);
  };

  const handleStatusChange = (
    memberId: string,
    newStatus: AttendanceStatus,
  ) => {
    setRoster((prev) =>
      prev.map((r) => (r.memberId === memberId ? { ...r, status: newStatus } : r)),
    );
  };

  const handleNotesChange = (memberId: string, notes: string) => {
    setRoster((prev) =>
      prev.map((r) => (r.memberId === memberId ? { ...r, notes } : r)),
    );
  };

  const handleSaveAttendance = async () => {
    if (!selectedSessionId) return;

    setIsSaving(true);
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

      const records = roster.map((r) => ({
        memberId: r.memberId,
        status: r.status,
        notes: r.notes || undefined,
      }));

      const response = await fetch("/api/admin/attendance", {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionId: selectedSessionId,
          records,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || "Failed to save attendance ledger",
        );
      }

      setFeedback({
        type: "success",
        text: `Successfully recorded attendance for ${records.length} members.`,
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Failed to save attendance. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleRecordAbsenceOnBehalf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !absenceMemberId) return;

    setIsSubmittingAbsence(true);
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

      const response = await fetch("/api/members/absences", {
        method: "POST",
        headers,
        body: JSON.stringify({
          memberId: absenceMemberId,
          sessionDate: selectedSession.sessionDate,
          sessionId: selectedSession.id,
          reason: absenceReason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || "Failed to record expected absence",
        );
      }

      const { absence } = await response.json();

      // Automatically update roster item to excused_absence and set expectedAbsence
      setRoster((prev) =>
        prev.map((r) =>
          r.memberId === absenceMemberId
            ? {
                ...r,
                status: "excused_absence",
                expectedAbsence: {
                  id: absence.id,
                  reason: absence.reason,
                  status: absence.status,
                },
              }
            : r,
        ),
      );

      setFeedback({
        type: "success",
        text: "Expected absence recorded on member's behalf.",
      });
      setShowAbsenceModal(false);
      setAbsenceReason("");
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Failed to record absence.",
      });
    } finally {
      setIsSubmittingAbsence(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Session Switcher */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Attendance Ledger
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Record actual meeting attendance, review expected absences, and save audited ledger entries.
          </p>
        </div>

        {sessions.length > 0 && (
          <div className="flex items-center gap-3">
            <label
              htmlFor="session-select"
              className="text-xs font-semibold text-muted-foreground whitespace-nowrap"
            >
              Session:
            </label>
            <select
              id="session-select"
              value={selectedSessionId}
              onChange={(e) => handleSessionChange(e.target.value)}
              className="border-border bg-surface text-foreground rounded-component border px-3 py-2 text-xs font-medium focus:ring-1 focus:ring-primary focus:outline-none"
            >
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.sessionDate} — {s.title} ({s.location})
                </option>
              ))}
            </select>
          </div>
        )}
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

      {selectedSession && (
        <>
          {/* Summary Stat Counters */}
          <div className="border-border bg-surface rounded-component grid grid-cols-2 gap-4 border p-4 sm:grid-cols-5">
            <div className="space-y-1 text-center">
              <span className="text-muted-foreground text-xs">Present</span>
              <p className="text-success text-xl font-bold">{presentCount}</p>
            </div>
            <div className="space-y-1 text-center">
              <span className="text-muted-foreground text-xs">Late</span>
              <p className="text-warning text-xl font-bold">{lateCount}</p>
            </div>
            <div className="space-y-1 text-center">
              <span className="text-muted-foreground text-xs">Excused</span>
              <p className="text-info text-xl font-bold">{excusedCount}</p>
            </div>
            <div className="space-y-1 text-center">
              <span className="text-muted-foreground text-xs">Unexcused</span>
              <p className="text-danger text-xl font-bold">{unexcusedCount}</p>
            </div>
            <div className="col-span-2 space-y-1 text-center sm:col-span-1">
              <span className="text-muted-foreground text-xs">Unmarked</span>
              <p className="text-foreground text-xl font-bold">{unmarkedCount}</p>
            </div>
          </div>

          {/* Roster Table */}
          {roster.length === 0 ? (
            <div className="border-border bg-surface rounded-component border py-12 text-center">
              <p className="text-muted-foreground text-sm">
                No active club members found to take attendance for.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs">
                  Showing {roster.length} active {roster.length === 1 ? "member" : "members"}
                </span>
                <button
                  type="button"
                  onClick={() => setShowAbsenceModal(true)}
                  className="border-border bg-surface text-foreground hover:bg-surface-raised rounded-component px-3 py-1.5 text-xs font-medium transition-colors"
                >
                  + Record Absence on Member&apos;s Behalf
                </button>
              </div>

              <div className="border-border bg-surface rounded-component overflow-x-auto border">
                <table className="w-full text-left text-sm">
                  <thead className="border-border bg-surface-raised border-b text-xs font-semibold text-muted-foreground">
                    <tr>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Expected Absence</th>
                      <th className="px-4 py-3">Attendance Status</th>
                      <th className="px-4 py-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y text-xs">
                    {roster.map((item) => (
                      <tr key={item.memberId} className="hover:bg-surface-raised/40">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-foreground">
                            {item.preferredName}
                          </div>
                          <div className="text-muted-foreground">
                            {item.email} {item.grade && `(${item.grade})`}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {item.expectedAbsence ? (
                            <span
                              className="border-info/30 bg-info-surface text-info inline-flex flex-col rounded-md border p-1.5 text-[11px]"
                              title={`Submitted absence: ${item.expectedAbsence.reason}`}
                            >
                              <strong className="font-semibold">Absence Notified:</strong>
                              <span className="line-clamp-1 italic">
                                &quot;{item.expectedAbsence.reason}&quot;
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={item.status}
                            onChange={(e) =>
                              handleStatusChange(
                                item.memberId,
                                e.target.value as AttendanceStatus,
                              )
                            }
                            className={`rounded-component border px-2.5 py-1.5 text-xs font-medium focus:outline-none ${
                              item.status === "present"
                                ? "border-success/40 bg-success-surface text-success"
                                : item.status === "late"
                                ? "border-warning/40 bg-warning-surface text-warning"
                                : item.status === "excused_absence"
                                ? "border-info/40 bg-info-surface text-info"
                                : item.status === "unexcused_absence"
                                ? "border-danger/40 bg-danger-surface text-danger"
                                : "border-border bg-surface text-muted-foreground"
                            }`}
                          >
                            <option value="unmarked">Unmarked</option>
                            <option value="present">Present</option>
                            <option value="late">Late</option>
                            <option value="excused_absence">Excused Absence</option>
                            <option value="unexcused_absence">Unexcused Absence</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={item.notes || ""}
                            onChange={(e) =>
                              handleNotesChange(item.memberId, e.target.value)
                            }
                            placeholder="Optional note"
                            maxLength={256}
                            className="border-border bg-surface text-foreground w-full rounded-component border px-2 py-1 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveAttendance}
                  disabled={isSaving}
                  className="bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active rounded-component focus-visible:outline-focus inline-flex min-h-10 items-center justify-center px-6 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
                >
                  {isSaving ? "Saving Ledger..." : "Save Attendance Ledger"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Record Absence On Behalf Modal */}
      {showAbsenceModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-absence-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="border-border bg-surface rounded-component w-full max-w-md space-y-4 border p-6 shadow-xl">
            <h2 id="record-absence-title" className="text-foreground text-lg font-bold">
              Record Absence on Member&apos;s Behalf
            </h2>
            <p className="text-muted-foreground text-xs">
              Log an expected absence notification for a member who communicated offline for session on{" "}
              <strong className="text-foreground">{selectedSession?.sessionDate}</strong>.
            </p>

            <form onSubmit={handleRecordAbsenceOnBehalf} className="space-y-4">
              <div>
                <label className="text-foreground block text-xs font-medium">
                  Select Member
                </label>
                <select
                  value={absenceMemberId}
                  onChange={(e) => setAbsenceMemberId(e.target.value)}
                  className="border-border bg-surface text-foreground mt-1 w-full rounded-component border px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  {roster.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.preferredName} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-foreground block text-xs font-medium">
                  Reason for Absence
                </label>
                <textarea
                  required
                  value={absenceReason}
                  onChange={(e) => setAbsenceReason(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Informs leadership of debate tournament trip."
                  rows={3}
                  className="border-border bg-surface text-foreground mt-1 w-full rounded-component border p-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAbsenceModal(false)}
                  disabled={isSubmittingAbsence}
                  className="border-border bg-surface text-foreground hover:bg-surface-raised rounded-component px-4 py-2 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAbsence}
                  className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-component px-4 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmittingAbsence ? "Recording..." : "Record Absence"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

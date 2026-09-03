"use client";

import { useId, useState } from "react";

import {
  type AttendanceTotals,
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

function getNextFriday(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = (5 - day + 7) % 7 || 7;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + diff);
  return nextFriday.toISOString().split("T")[0];
}

export interface MemberHubProps {
  member: {
    id: string;
    preferredName: string;
    email: string;
    grade: string | null;
    status: string;
    joinedAt: string;
  };
  upcomingSession: SessionListItem | null;
  attendanceTotals: AttendanceTotals;
}

export function MemberHubView({
  member,
  upcomingSession,
  attendanceTotals,
}: MemberHubProps) {
  const [absenceDate, setAbsenceDate] = useState(
    upcomingSession?.sessionDate || getNextFriday(),
  );
  const [absenceReason, setAbsenceReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const dateId = useId();
  const reasonId = useId();

  const handleAbsenceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const response = await fetch("/api/members/absences", {
        method: "POST",
        headers,
        body: JSON.stringify({
          sessionDate: absenceDate,
          sessionId: upcomingSession?.id,
          reason: absenceReason,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || "Failed to submit expected absence",
        );
      }

      setFeedback({
        type: "success",
        text: "Your expected absence notification has been sent to leadership.",
      });
      setAbsenceReason("");
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Failed to submit absence. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Header Profile Card */}
      <div className="panel space-y-4 p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="space-y-1">
            <div className="border-border bg-surface-raised text-primary inline-flex items-center gap-2 rounded-full border px-3 py-0.5 text-xs font-semibold">
              <span>LOGOS Member</span>
              <span aria-hidden="true">•</span>
              <span>{member.grade || "High School"}</span>
            </div>
            <h1 className="heading-1">Welcome back, {member.preferredName}</h1>
            <p className="text-muted-foreground text-xs">{member.email}</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="border-success/30 bg-success-surface text-success inline-flex rounded-full border px-3 py-1 text-xs font-semibold">
              Active Member
            </span>
          </div>
        </div>
      </div>

      {/* Grid: Next Session & Attendance Stats */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Next Meeting */}
        <div className="panel space-y-4 p-6">
          <h2 className="text-foreground text-base font-bold">
            Next Club Meeting
          </h2>

          {upcomingSession ? (
            <div className="space-y-3">
              <div className="panel-raised p-4">
                <p className="text-primary text-xs font-bold tracking-wider uppercase">
                  {upcomingSession.sessionDate}
                </p>
                <h3 className="text-foreground mt-1 text-base font-bold">
                  {upcomingSession.title}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs">
                  {upcomingSession.startTime} – {upcomingSession.endTime} •{" "}
                  {upcomingSession.location}
                </p>
                {upcomingSession.notes && (
                  <p className="text-muted-foreground mt-2 text-xs italic">
                    {upcomingSession.notes}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="panel-raised text-muted-foreground p-4 text-xs">
              <p className="text-foreground font-semibold">
                Regular Meeting Time:
              </p>
              <p className="mt-1">
                Every Friday after school, 15:30–16:30 in Room 101.
              </p>
            </div>
          )}
        </div>

        {/* My Attendance Summary */}
        <div className="panel space-y-4 p-6">
          <h2 className="text-foreground text-base font-bold">
            My Attendance Record
          </h2>

          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="panel-raised p-3">
              <span className="text-muted-foreground text-[11px]">Present</span>
              <p className="text-success text-lg font-bold">
                {attendanceTotals.presentCount}
              </p>
            </div>
            <div className="panel-raised p-3">
              <span className="text-muted-foreground text-[11px]">Late</span>
              <p className="text-warning text-lg font-bold">
                {attendanceTotals.lateCount}
              </p>
            </div>
            <div className="panel-raised p-3">
              <span className="text-muted-foreground text-[11px]">Excused</span>
              <p className="text-info text-lg font-bold">
                {attendanceTotals.excusedCount}
              </p>
            </div>
          </div>

          <div className="border-border text-muted-foreground flex items-center justify-between border-t pt-3 text-xs">
            <span>Overall Attendance Rate:</span>
            <strong className="text-foreground text-sm font-bold">
              {attendanceTotals.attendanceRate}%
            </strong>
          </div>
        </div>
      </div>

      {/* Submit Expected Absence Form */}
      {/* id is the target of "Excuse an absence" in the header profile menu. */}
      <div id="absence" className="panel scroll-mt-24 space-y-4 p-6">
        <div>
          <h2 className="text-foreground text-base font-bold">
            Notify Upcoming Absence
          </h2>
          <p className="text-muted-foreground text-xs">
            If you cannot attend an upcoming Friday session due to a conflict,
            submit notice here so leadership can record an excused absence.
          </p>
        </div>

        {feedback && (
          <div
            role="status"
            aria-live="polite"
            className={`rounded-component border p-3 text-xs ${
              feedback.type === "success"
                ? "border-success bg-success-surface text-success"
                : "border-danger bg-danger-surface text-danger"
            }`}
          >
            {feedback.text}
          </div>
        )}

        <form onSubmit={handleAbsenceSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor={dateId}
                className="text-foreground block text-xs font-medium"
              >
                Session Date
              </label>
              <input
                id={dateId}
                type="date"
                required
                value={absenceDate}
                onChange={(e) => setAbsenceDate(e.target.value)}
                className="field-input mt-1"
              />
            </div>
            <div>
              <label
                htmlFor={reasonId}
                className="text-foreground block text-xs font-medium"
              >
                Reason for Absence
              </label>
              <input
                id={reasonId}
                type="text"
                required
                maxLength={500}
                placeholder="e.g. Doctor appointment, debate tournament, etc."
                value={absenceReason}
                onChange={(e) => setAbsenceReason(e.target.value)}
                className="field-input mt-1"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="action action-primary"
            >
              <span className="action-label">
                {isSubmitting ? "Submitting…" : "Submit absence notice"}
              </span>
              <span className="action-label-hover" aria-hidden="true">
                {isSubmitting ? "Submitting…" : "Submit absence notice"}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Approved Club Resources */}
      <div className="panel space-y-4 p-6">
        <h2 className="text-foreground text-base font-bold">
          Approved Club Resources
        </h2>
        <p className="text-muted-foreground text-xs">
          Access shared materials and problem sets via approved Tokyo
          International School links:
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="panel-raised p-4">
            <h3 className="text-foreground text-sm font-semibold">
              Google Classroom
            </h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Weekly problem sets, solution notes, and workshop handouts.
            </p>
            <span className="text-primary mt-2 inline-block text-xs font-medium">
              Join code distributed in Room 101
            </span>
          </div>

          <div className="panel-raised p-4">
            <h3 className="text-foreground text-sm font-semibold">
              Shared Resource Drive
            </h3>
            <p className="text-muted-foreground mt-1 text-xs">
              Olympiad archive files, past contest rounds, and study guides.
            </p>
            <span className="text-primary mt-2 inline-block text-xs font-medium">
              Restricted to verified @tokyois.com members
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

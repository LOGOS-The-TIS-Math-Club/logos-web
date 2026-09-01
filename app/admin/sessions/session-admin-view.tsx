"use client";

import { useId, useState } from "react";
import Link from "next/link";

import { type SessionListItem } from "@/lib/attendance/schema";

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
  const day = today.getDay(); // 0 is Sunday, 5 is Friday
  const diff = (5 - day + 7) % 7 || 7;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + diff);
  return nextFriday.toISOString().split("T")[0];
}

export function SessionAdminView({
  initialSessions,
}: {
  initialSessions: SessionListItem[];
}) {
  const [sessions, setSessions] = useState<SessionListItem[]>(initialSessions);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Form state
  const [title, setTitle] = useState("LOGOS Weekly Meeting");
  const [sessionDate, setSessionDate] = useState(getNextFriday());
  const [startTime, setStartTime] = useState("15:30");
  const [endTime, setEndTime] = useState("16:30");
  const [location, setLocation] = useState("Room 101");
  const [notes, setNotes] = useState("");

  const titleId = useId();
  const dateId = useId();
  const startId = useId();
  const endId = useId();
  const locId = useId();
  const notesId = useId();

  const handleCreate = async (e: React.FormEvent) => {
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

      const response = await fetch("/api/admin/sessions", {
        method: "POST",
        headers,
        body: JSON.stringify({
          title,
          sessionDate,
          startTime,
          endTime,
          location,
          notes: notes || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message || "Failed to create club session",
        );
      }

      const { session } = await response.json();

      const newSessionItem: SessionListItem = {
        id: session.id,
        title: session.title,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
        location: session.location,
        notes: session.notes,
        createdAt: new Date().toISOString(),
        presentCount: 0,
        totalMarked: 0,
      };

      setSessions((prev) => [newSessionItem, ...prev]);
      setFeedback({
        type: "success",
        text: `Created session "${session.title}" for ${session.sessionDate}.`,
      });
      setShowCreateModal(false);
      setNotes("");
    } catch (err: any) {
      setFeedback({
        type: "error",
        text: err?.message || "Creation failed. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Create Button */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Club Sessions
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create club sessions and manage meeting attendance.
          </p>
        </div>
        <div>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active rounded-component focus-visible:outline-focus inline-flex min-h-10 items-center justify-center px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            + Create New Session
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

      {/* Sessions Grid / Table */}
      {sessions.length === 0 ? (
        <div className="border-border bg-surface rounded-component border py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No club sessions recorded yet. Click &quot;Create New Session&quot; to add your first meeting.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="border-border bg-surface rounded-component flex flex-col justify-between border p-5 transition-colors hover:border-border/80"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-primary text-xs font-bold uppercase tracking-wider">
                    {session.sessionDate}
                  </span>
                  <span className="border-border bg-surface-raised rounded-full border px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {session.location}
                  </span>
                </div>

                <h2 className="text-foreground text-base font-bold">
                  {session.title}
                </h2>

                <p className="text-muted-foreground text-xs">
                  {session.startTime} – {session.endTime}
                </p>

                {session.notes && (
                  <p className="text-muted-foreground line-clamp-2 text-xs italic">
                    {session.notes}
                  </p>
                )}
              </div>

              <div className="border-border mt-5 flex items-center justify-between border-t pt-4 text-xs">
                <span className="text-muted-foreground">
                  Attendance:{" "}
                  <strong className="text-foreground">
                    {session.presentCount} present
                  </strong>{" "}
                  ({session.totalMarked} marked)
                </span>
                <Link
                  href={`/admin/attendance?sessionId=${session.id}`}
                  className="text-primary hover:text-primary-hover font-semibold focus-visible:outline-focus rounded focus-visible:outline-1"
                >
                  Mark Ledger →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Session Modal */}
      {showCreateModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-session-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="border-border bg-surface rounded-component w-full max-w-lg space-y-4 border p-6 shadow-xl">
            <h2 id="create-session-title" className="text-foreground text-lg font-bold">
              Create Club Session
            </h2>
            <p className="text-muted-foreground text-xs">
              Configure session date, time, and meeting room. Default Friday 15:30–16:30, Room 101.
            </p>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label htmlFor={titleId} className="text-foreground block text-xs font-medium">
                  Title
                </label>
                <input
                  id={titleId}
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="border-border bg-surface text-foreground mt-1 w-full rounded-component border px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor={dateId} className="text-foreground block text-xs font-medium">
                    Date
                  </label>
                  <input
                    id={dateId}
                    type="date"
                    required
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="border-border bg-surface text-foreground mt-1 w-full rounded-component border px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={locId} className="text-foreground block text-xs font-medium">
                    Location
                  </label>
                  <input
                    id={locId}
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="border-border bg-surface text-foreground mt-1 w-full rounded-component border px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor={startId} className="text-foreground block text-xs font-medium">
                    Start Time
                  </label>
                  <input
                    id={startId}
                    type="text"
                    required
                    placeholder="15:30"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="border-border bg-surface text-foreground mt-1 w-full rounded-component border px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor={endId} className="text-foreground block text-xs font-medium">
                    End Time
                  </label>
                  <input
                    id={endId}
                    type="text"
                    required
                    placeholder="16:30"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="border-border bg-surface text-foreground mt-1 w-full rounded-component border px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor={notesId} className="text-foreground block text-xs font-medium">
                  Session Notes (Optional)
                </label>
                <textarea
                  id={notesId}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Focus on AMC 12 Geometry and Combinatorics problem set."
                  rows={3}
                  className="border-border bg-surface text-foreground mt-1 w-full rounded-component border p-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  disabled={isSubmitting}
                  className="border-border bg-surface text-foreground hover:bg-surface-raised rounded-component px-4 py-2 text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary text-primary-foreground hover:bg-primary-hover rounded-component px-4 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Create Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

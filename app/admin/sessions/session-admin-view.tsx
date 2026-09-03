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
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
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

  function openCreate() {
    setEditingId(null);
    setTitle("LOGOS Weekly Meeting");
    setSessionDate(getNextFriday());
    setStartTime("15:30");
    setEndTime("16:30");
    setLocation("Room 101");
    setNotes("");
    setShowModal(true);
  }

  function openEdit(session: SessionListItem) {
    setEditingId(session.id);
    setTitle(session.title);
    setSessionDate(session.sessionDate);
    setStartTime(session.startTime);
    setEndTime(session.endTime);
    setLocation(session.location);
    setNotes(session.notes ?? "");
    setShowModal(true);
  }

  const titleId = useId();
  const dateId = useId();
  const startId = useId();
  const endId = useId();
  const locId = useId();
  const notesId = useId();

  const handleSubmit = async (e: React.FormEvent) => {
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

      const response = await fetch(
        editingId ? `/api/admin/sessions/${editingId}` : "/api/admin/sessions",
        {
          method: "POST",
          headers,
          body: JSON.stringify({
            title,
            sessionDate,
            startTime,
            endTime,
            location,
            // null clears an existing note on edit; undefined leaves the field
            // untouched on create.
            notes: notes || (editingId ? null : undefined),
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error?.message ||
            `Failed to ${editingId ? "update" : "create"} club session`,
        );
      }

      const { session } = await response.json();

      if (editingId) {
        // Attendance counts are not returned by the update, so carry the
        // existing ones forward rather than resetting them to zero on screen.
        setSessions((prev) =>
          prev.map((item) =>
            item.id === editingId
              ? {
                  ...item,
                  title: session.title,
                  sessionDate: session.sessionDate,
                  startTime: session.startTime,
                  endTime: session.endTime,
                  location: session.location,
                  notes: session.notes,
                }
              : item,
          ),
        );
        setFeedback({
          type: "success",
          text: `Updated "${session.title}" (${session.sessionDate}).`,
        });
      } else {
        setSessions((prev) => [
          {
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
          },
          ...prev,
        ]);
        setFeedback({
          type: "success",
          text: `Created session "${session.title}" for ${session.sessionDate}.`,
        });
      }

      setShowModal(false);
      setEditingId(null);
      setNotes("");
    } catch (err: unknown) {
      setFeedback({
        type: "error",
        text:
          err instanceof Error ? err.message : "Save failed. Please try again.",
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
            onClick={openCreate}
            className="control control-primary"
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
        <div className="panel py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No club sessions recorded yet. Click &quot;Create New Session&quot;
            to add your first meeting.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="panel hover:border-border/80 flex flex-col justify-between p-5 transition-colors"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-primary text-xs font-bold tracking-wider uppercase">
                    {session.sessionDate}
                  </span>
                  <span className="border-border bg-surface-raised text-muted-foreground rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
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
                <span className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => openEdit(session)}
                    className="text-muted-foreground hover:text-foreground focus-visible:outline-focus rounded font-semibold focus-visible:outline-1"
                  >
                    Edit
                  </button>
                  <Link
                    href={`/admin/attendance?sessionId=${session.id}`}
                    className="text-primary hover:text-primary-hover focus-visible:outline-focus rounded font-semibold focus-visible:outline-1"
                  >
                    Mark Ledger →
                  </Link>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / edit session */}
      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-session-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="panel w-full max-w-lg space-y-4 p-6 shadow-xl">
            <h2
              id="create-session-title"
              className="text-foreground text-lg font-bold"
            >
              {editingId ? "Edit Club Session" : "Create Club Session"}
            </h2>
            <p className="text-muted-foreground text-xs">
              The topic and date appear in the public programme on the home and
              meetings pages. Default Friday 15:30–16:30, Room 101.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor={titleId}
                  className="text-foreground block text-xs font-medium"
                >
                  Topic
                </label>
                <input
                  id={titleId}
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="field-input"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor={dateId}
                    className="text-foreground block text-xs font-medium"
                  >
                    Date
                  </label>
                  <input
                    id={dateId}
                    type="date"
                    required
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className="field-input"
                  />
                </div>
                <div>
                  <label
                    htmlFor={locId}
                    className="text-foreground block text-xs font-medium"
                  >
                    Location
                  </label>
                  <input
                    id={locId}
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="field-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor={startId}
                    className="text-foreground block text-xs font-medium"
                  >
                    Start Time
                  </label>
                  <input
                    id={startId}
                    type="text"
                    required
                    placeholder="15:30"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="field-input"
                  />
                </div>
                <div>
                  <label
                    htmlFor={endId}
                    className="text-foreground block text-xs font-medium"
                  >
                    End Time
                  </label>
                  <input
                    id={endId}
                    type="text"
                    required
                    placeholder="16:30"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="field-input"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor={notesId}
                  className="text-foreground block text-xs font-medium"
                >
                  Session Notes (Optional)
                </label>
                <textarea
                  id={notesId}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. Focus on AMC 12 Geometry and Combinatorics problem set."
                  rows={3}
                  className="panel text-foreground focus:ring-primary mt-1 w-full p-2 text-xs focus:ring-1 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                  }}
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
                  {isSubmitting
                    ? "Saving..."
                    : editingId
                      ? "Save Changes"
                      : "Create Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

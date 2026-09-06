"use client";

import { useId, useState } from "react";

import { ImagePicker } from "@/components/admin/image-picker";
import { type StoryEntryListItem } from "@/lib/story/schema";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ""
  );
}

function csrfHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const csrfToken = decodeURIComponent(getCookie("__Host-logos_csrf"));
  const sessionCsrfToken = decodeURIComponent(
    getCookie("__Host-logos_session_csrf"),
  );
  if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
  if (sessionCsrfToken) headers["X-Session-CSRF-Token"] = sessionCsrfToken;
  return headers;
}

export function StoryAdminView({
  initialEntries,
}: {
  initialEntries: StoryEntryListItem[];
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [occurredOn, setOccurredOn] = useState("");
  const [imageId, setImageId] = useState<string | null>(null);
  const [published, setPublished] = useState(false);

  const titleId = useId();
  const bodyId = useId();
  const dateId = useId();
  const publishedId = useId();

  function openCreate() {
    setEditingId(null);
    setTitle("");
    setBody("");
    setOccurredOn(new Date().toISOString().slice(0, 10));
    setImageId(null);
    setPublished(false);
    setShowModal(true);
  }

  function openEdit(entry: StoryEntryListItem) {
    setEditingId(entry.id);
    setTitle(entry.title);
    setBody(entry.body);
    setOccurredOn(entry.occurredOn);
    setImageId(entry.imageId);
    setPublished(entry.published);
    setShowModal(true);
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);

    try {
      const response = await fetch(
        editingId ? `/api/admin/story/${editingId}` : "/api/admin/story",
        {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({
            title,
            body,
            occurredOn,
            imageId,
            published,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.message || "Failed to save the entry");
      }

      const { entry } = await response.json();

      setEntries((prev) => {
        const next = editingId
          ? prev.map((item) =>
              item.id === editingId ? { ...item, ...entry } : item,
            )
          : [{ ...entry, imageAlt: null }, ...prev];
        // Newest first, matching the order the server returns.
        return [...next].sort((a, b) =>
          b.occurredOn.localeCompare(a.occurredOn),
        );
      });

      setFeedback({
        type: "success",
        text: `${editingId ? "Updated" : "Added"} “${entry.title}”.`,
      });
      setShowModal(false);
      setEditingId(null);
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Save failed.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: StoryEntryListItem) => {
    const confirmed = window.confirm(
      `Delete “${entry.title}”?\n\nThis removes it from the public story and cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingId(entry.id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/story/${entry.id}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });

      if (!response.ok) throw new Error("Failed to delete the entry");

      setEntries((prev) => prev.filter((item) => item.id !== entry.id));
      setFeedback({ type: "success", text: `Deleted “${entry.title}”.` });
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Delete failed.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="heading-1">Our story</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            The club&rsquo;s milestones, with pictures &mdash; the founding, a
            first competition, the session where something clicked. Worth
            recording, not every meeting. Published entries appear on{" "}
            <code>/story</code> immediately.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="control control-primary"
        >
          + Add milestone
        </button>
      </div>

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

      {entries.length === 0 ? (
        <div className="panel py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No milestones yet. Add the first one.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="datum text-subtle-foreground text-xs">
                    {entry.occurredOn}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      entry.published
                        ? "border-success/30 bg-success-surface text-success"
                        : "border-border bg-surface-raised text-muted-foreground"
                    }`}
                  >
                    {entry.published ? "Published" : "Draft"}
                  </span>
                  {entry.imageId ? (
                    <span className="text-subtle-foreground text-[11px]">
                      has picture
                    </span>
                  ) : null}
                </div>
                <p className="text-foreground font-semibold">{entry.title}</p>
                <p className="text-muted-foreground line-clamp-2 text-sm">
                  {entry.body}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => openEdit(entry)}
                  className="text-muted-foreground hover:text-foreground focus-visible:outline-focus rounded font-semibold focus-visible:outline-1"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(entry)}
                  disabled={deletingId === entry.id}
                  className="text-muted-foreground hover:text-danger focus-visible:outline-focus rounded font-semibold focus-visible:outline-1 disabled:opacity-50"
                >
                  {deletingId === entry.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {showModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="story-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4"
        >
          <div className="panel my-8 w-full max-w-lg space-y-4 p-6 shadow-xl">
            <h2 id="story-modal-title" className="heading-3">
              {editingId ? "Edit milestone" : "Add milestone"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor={dateId}
                  className="text-foreground block text-xs font-medium"
                >
                  When it happened
                </label>
                <input
                  id={dateId}
                  type="date"
                  required
                  value={occurredOn}
                  onChange={(event) => setOccurredOn(event.target.value)}
                  className="field-input"
                />
              </div>

              <div>
                <label
                  htmlFor={titleId}
                  className="text-foreground block text-xs font-medium"
                >
                  Title
                </label>
                <input
                  id={titleId}
                  type="text"
                  required
                  maxLength={120}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="field-input"
                />
              </div>

              <div>
                <label
                  htmlFor={bodyId}
                  className="text-foreground block text-xs font-medium"
                >
                  What happened, and why it mattered
                </label>
                <textarea
                  id={bodyId}
                  required
                  maxLength={4000}
                  rows={6}
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="panel text-foreground focus:ring-primary mt-1 w-full p-2 text-xs focus:ring-1 focus:outline-none"
                />
                <p className="text-subtle-foreground mt-1 text-xs">
                  Leave a blank line between paragraphs.
                </p>
              </div>

              <ImagePicker value={imageId} onChange={setImageId} />

              <div className="border-border flex items-center gap-2 border-t pt-4">
                <input
                  id={publishedId}
                  type="checkbox"
                  checked={published}
                  onChange={(event) => setPublished(event.target.checked)}
                  className="accent-primary"
                />
                <label
                  htmlFor={publishedId}
                  className="text-foreground text-xs"
                >
                  Publish on the public story page
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                  }}
                  disabled={saving}
                  className="control"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="control control-primary"
                >
                  {saving
                    ? "Saving…"
                    : editingId
                      ? "Save changes"
                      : "Add entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

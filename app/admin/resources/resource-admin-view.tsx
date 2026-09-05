"use client";

import { useId, useState } from "react";

import { type ResourceItem } from "@/lib/resources/schema";

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

/*
 * The cards on the member dashboard. Classroom and Drive used to be written
 * into the view, so changing a link meant a deploy; they are rows now and any
 * number of them can exist.
 */
export function ResourceAdminView({
  initialResources,
}: {
  initialResources: ResourceItem[];
}) {
  const [resources, setResources] = useState<ResourceItem[]>(initialResources);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("https://");
  const [sortOrder, setSortOrder] = useState(0);

  const titleId = useId();
  const descId = useId();
  const urlId = useId();
  const orderId = useId();

  function openCreate() {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setUrl("https://");
    setSortOrder(resources.length);
    setShowModal(true);
  }

  function openEdit(resource: ResourceItem) {
    setEditingId(resource.id);
    setTitle(resource.title);
    setDescription(resource.description);
    setUrl(resource.url);
    setSortOrder(resource.sortOrder);
    setShowModal(true);
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const response = await fetch(
        editingId
          ? `/api/admin/resources/${editingId}`
          : "/api/admin/resources",
        {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({ title, description, url, sortOrder }),
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
            errorData?.error?.message ||
            `Failed to ${editingId ? "update" : "create"} the resource`,
        );
      }

      const { resource } = await response.json();

      setResources((prev) => {
        const next = editingId
          ? prev.map((item) => (item.id === editingId ? resource : item))
          : [...prev, resource];
        // Match the order the dashboard renders in, so the admin list is not
        // a different order from the thing it is editing.
        return next.sort(
          (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
        );
      });

      setFeedback({
        type: "success",
        text: `${editingId ? "Updated" : "Added"} “${resource.title}”.`,
      });
      setShowModal(false);
      setEditingId(null);
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Save failed. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (resource: ResourceItem) => {
    const confirmed = window.confirm(
      `Remove “${resource.title}” from the member dashboard?`,
    );
    if (!confirmed) return;

    setDeletingId(resource.id);
    setFeedback(null);

    try {
      const response = await fetch(`/api/admin/resources/${resource.id}`, {
        method: "DELETE",
        headers: csrfHeaders(),
      });

      if (!response.ok) throw new Error("Failed to remove the resource");

      setResources((prev) => prev.filter((item) => item.id !== resource.id));
      setFeedback({ type: "success", text: `Removed “${resource.title}”.` });
    } catch (error: unknown) {
      setFeedback({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Remove failed. Please try again.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="heading-1">Club Resources</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            The link cards on the member dashboard. Changes appear immediately,
            with no deploy.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="control control-primary"
        >
          + Add Resource
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

      {resources.length === 0 ? (
        <div className="panel py-12 text-center">
          <p className="text-muted-foreground text-sm">
            No resources yet. Members will see an empty section on their
            dashboard until you add one.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {resources.map((resource) => (
            <li
              key={resource.id}
              className="panel flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-foreground font-semibold">
                  {resource.title}
                </p>
                <p className="text-muted-foreground text-sm">
                  {resource.description}
                </p>
                <p className="text-subtle-foreground truncate text-xs">
                  {resource.url}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => openEdit(resource)}
                  className="text-muted-foreground hover:text-foreground focus-visible:outline-focus rounded font-semibold focus-visible:outline-1"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(resource)}
                  disabled={deletingId === resource.id}
                  className="text-muted-foreground hover:text-danger focus-visible:outline-focus rounded font-semibold focus-visible:outline-1 disabled:opacity-50"
                >
                  {deletingId === resource.id ? "Removing…" : "Remove"}
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
          aria-labelledby="resource-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="panel w-full max-w-lg space-y-4 p-6 shadow-xl">
            <h2 id="resource-modal-title" className="heading-3">
              {editingId ? "Edit Resource" : "Add Resource"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor={titleId}
                  className="text-foreground block text-xs font-medium"
                >
                  Name
                </label>
                <input
                  id={titleId}
                  type="text"
                  required
                  maxLength={80}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="field-input"
                />
              </div>

              <div>
                <label
                  htmlFor={descId}
                  className="text-foreground block text-xs font-medium"
                >
                  Description
                </label>
                <input
                  id={descId}
                  type="text"
                  required
                  maxLength={280}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  className="field-input"
                />
              </div>

              <div>
                <label
                  htmlFor={urlId}
                  className="text-foreground block text-xs font-medium"
                >
                  Link
                </label>
                <input
                  id={urlId}
                  type="url"
                  required
                  pattern="https://.*"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  className="field-input"
                />
                <p className="text-subtle-foreground mt-1 text-xs">
                  Must start with <code>https://</code>.
                </p>
              </div>

              <div>
                <label
                  htmlFor={orderId}
                  className="text-foreground block text-xs font-medium"
                >
                  Order
                </label>
                <input
                  id={orderId}
                  type="number"
                  min={0}
                  max={999}
                  value={sortOrder}
                  onChange={(event) => setSortOrder(Number(event.target.value))}
                  className="field-input"
                />
                <p className="text-subtle-foreground mt-1 text-xs">
                  Lower numbers appear first.
                </p>
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
                    ? "Saving…"
                    : editingId
                      ? "Save Changes"
                      : "Add Resource"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

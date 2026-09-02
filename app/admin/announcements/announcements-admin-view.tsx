"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { AnnouncementRecord } from "@/lib/announcements/schema";

/*
 * Announcement editor.
 *
 * Deliberately plain: a list, an inline form, and a publish toggle. Everything
 * writes through /api/admin/announcements, which re-checks the capability
 * server-side — nothing here is trusted.
 */

function cookie(name: string): string {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((row) => row.startsWith(`${name}=`))
      ?.slice(name.length + 1) ?? ""
  );
}

async function send(method: string, body: unknown) {
  return fetch("/api/admin/announcements", {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": decodeURIComponent(cookie("__Host-logos_csrf")),
      "X-Session-CSRF-Token": decodeURIComponent(
        cookie("__Host-logos_session_csrf"),
      ),
    },
    body: JSON.stringify(body),
  });
}

const EMPTY = { id: "", title: "", body: "", published: false };

export function AnnouncementsAdminView({
  announcements,
}: {
  announcements: AnnouncementRecord[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editing = draft.id !== "";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const payload = {
        title: draft.title.trim(),
        body: draft.body.trim(),
        published: draft.published,
        ...(editing ? { id: draft.id } : {}),
      };
      const response = await send(editing ? "PATCH" : "POST", payload);
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        throw new Error(data?.message ?? "Could not save the announcement.");
      }
      setDraft(EMPTY);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not save. Try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string, title: string) {
    if (!window.confirm(`Delete “${title}”? This cannot be undone.`)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await send("DELETE", { id });
      if (!response.ok) throw new Error("Could not delete the announcement.");
      if (draft.id === id) setDraft(EMPTY);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-10">
      <form onSubmit={submit} className="panel space-y-5 p-6 sm:p-8">
        <h2 className="text-xl font-bold tracking-[-0.015em]">
          {editing ? "Edit announcement" : "New announcement"}
        </h2>

        {error ? (
          <p role="alert" className="alert-danger text-danger p-3 text-sm">
            {error}
          </p>
        ) : null}

        <div className="space-y-2">
          <label htmlFor="announcement-title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="announcement-title"
            required
            maxLength={120}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            className="border-border-input bg-surface text-foreground focus-visible:border-primary focus-visible:outline-focus rounded-component w-full border px-3.5 py-2.5 text-sm transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="announcement-body" className="text-sm font-medium">
            Announcement
          </label>
          <textarea
            id="announcement-body"
            required
            rows={4}
            maxLength={2000}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            className="border-border-input bg-surface text-foreground focus-visible:border-primary focus-visible:outline-focus rounded-component w-full border px-3.5 py-2.5 text-sm transition-colors"
          />
          <p className="text-subtle-foreground text-xs">
            {draft.body.length}/2000 characters
          </p>
        </div>

        <label className="flex items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={draft.published}
            onChange={(e) =>
              setDraft({ ...draft, published: e.target.checked })
            }
            className="size-4"
          />
          Publish to the public site
        </label>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={busy}
            className="action action-primary"
          >
            <span className="action-label">
              {busy ? "Saving…" : editing ? "Save changes" : "Create"}
            </span>
            <span className="action-label-hover" aria-hidden="true">
              {busy ? "Saving…" : editing ? "Save changes" : "Create"}
            </span>
          </button>
          {editing ? (
            <button
              type="button"
              onClick={() => setDraft(EMPTY)}
              className="action action-quiet"
            >
              <span className="action-label">Cancel</span>
              <span className="action-label-hover" aria-hidden="true">
                Cancel
              </span>
            </button>
          ) : null}
        </div>
      </form>

      <section aria-labelledby="existing-heading" className="space-y-4">
        <h2 id="existing-heading" className="text-xl font-bold">
          All announcements
        </h2>

        {announcements.length === 0 ? (
          <p className="border-border text-muted-foreground border-t border-b py-8 text-sm">
            Nothing yet. Anything you publish here appears on the home page
            immediately — no deploy needed.
          </p>
        ) : (
          <ul className="border-border divide-border divide-y border-t border-b">
            {announcements.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-4 py-4"
              >
                <div className="min-w-0 space-y-1">
                  <p className="flex items-center gap-2 font-medium">
                    {item.title}
                    <span
                      className={`eyebrow ${item.published ? "text-success" : "text-subtle-foreground"}`}
                    >
                      {item.published ? "Live" : "Draft"}
                    </span>
                  </p>
                  <p className="text-muted-foreground max-w-prose text-sm">
                    {item.body.length > 160
                      ? `${item.body.slice(0, 160)}…`
                      : item.body}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        id: item.id,
                        title: item.title,
                        body: item.body,
                        published: item.published,
                      })
                    }
                    className="action action-sm"
                  >
                    <span className="action-label">Edit</span>
                    <span className="action-label-hover" aria-hidden="true">
                      Edit
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(item.id, item.title)}
                    disabled={busy}
                    className="action action-sm action-quiet"
                  >
                    <span className="action-label">Delete</span>
                    <span className="action-label-hover" aria-hidden="true">
                      Delete
                    </span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";
import { useState } from "react";
import { ActionButton } from "../action.tsx";
import { DraftGuard } from "../dashboard/draft-guard.tsx";
import type { getRecurringSettings } from "../../src/sessions/recurring.ts";
import { adminRequest } from "../../src/admin/request.ts";
import {
  useRead,
  useFeedback,
  AdminForm,
  Status,
  RecordLink,
  Filter,
  Search,
  ReadState,
  Panel,
  Field,
  Message,
  formValues,
} from "./shared.tsx";
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export function Schedule() {
  const read = useRead<Awaited<ReturnType<typeof getRecurringSettings>>>(
    "/api/admin/recurring-meeting",
  );
  const [dirty, setDirty] = useState(false),
    [pending, setPending] = useState(false),
    [message, setMessage] = useFeedback();
  const s = read.data;
  return (
    <Panel
      title="Regular meeting schedule"
      description="Set the club's recurring day and time. Individual sessions keep their own dates and times."
    >
      <DraftGuard subject="schedule draft" dirty={dirty} />
      <p>
        Published settings appear on Home and Meetings. Withholding removes the
        public day, time, duration and room together. Existing sessions are
        never rescheduled.
      </p>
      <ReadState
        {...read}
        retry={() => {
          if (
            !dirty ||
            confirm("Discard this draft and load current settings?")
          ) {
            setDirty(false);
            read.refresh();
          }
        }}
      />
      <Message>{message}</Message>
      {!read.loading && !read.error ? (
        <AdminForm
          feedback={message}
          method="post"
          key={s?.revision ?? 0}
          className="admin-form"
          onDirty={() => setDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending) return;
            const b = formValues(e.currentTarget);
            setPending(true);
            try {
              await adminRequest("/api/admin/recurring-meeting", "PUT", {
                weekday: Number(b.weekday),
                startTime: b.startTime,
                durationMinutes: Number(b.durationMinutes),
                room: b.room,
                published: b.published === "on",
                revision: s?.revision ?? 0,
              });
              setDirty(false);
              setMessage(
                "Recurring settings saved. Existing sessions are unchanged.",
              );
              read.refresh();
            } catch (e) {
              setMessage(
                e instanceof Error
                  ? e
                  : new Error("The request could not be completed."),
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <fieldset disabled={pending}>
            <Field
              name="weekday"
              label="Meeting day"
              options={weekdays.map((d, i) => [String(i), d])}
              value={s?.weekday ?? 5}
            />
            <Field
              name="startTime"
              label="Start time (Tokyo)"
              type="time"
              value={s?.start_time.slice(0, 5) ?? "15:30"}
              required
            />
            <Field
              name="durationMinutes"
              label="Duration in minutes"
              type="number"
              value={s?.duration_minutes ?? 60}
              required
            />
            <Field
              name="room"
              label="Room (optional)"
              value={s?.room}
              maxLength={120}
            />
            <div className="admin-publication">
              <h3>Public visibility</h3>
              <label className="application-check">
                <input
                  type="checkbox"
                  name="published"
                  defaultChecked={s?.published ?? false}
                />{" "}
                Publish day, Tokyo time, duration and room on Home and Meetings
              </label>
              <p>
                State: {s?.published ? "Published" : "Withheld"}. Publishing
                takes effect when you save.
              </p>
            </div>
            <div className="admin-save-bar">
              <span className="admin-hint">
                {dirty
                  ? "Unsaved schedule changes"
                  : "Recurring meeting defaults"}
              </span>
              <ActionButton type="submit" variant="primary">
                {pending ? "Saving..." : "Save recurring settings"}
              </ActionButton>
            </div>
          </fieldset>
        </AdminForm>
      ) : null}
    </Panel>
  );
}

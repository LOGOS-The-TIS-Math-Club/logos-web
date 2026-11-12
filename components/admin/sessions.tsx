"use client";
import Link from "next/link";
import { DashboardIcon } from "../dashboard/icon.tsx";
import { ApplicationInput } from "../application-input.tsx";
import { sessionEditorDateTime, shiftCalendarDay } from "../../src/admin/presentation.ts";
import { useState, useEffect, useRef } from "react";
import { ActionButton, ActionLink } from "../action.tsx";
import { DraftGuard } from "../dashboard/draft-guard.tsx";
import { adminRequest } from "../../src/admin/request.ts";
import type { getSessionAttendance } from "../../src/attendance/operations.ts";
import {
  useRead,
  AdminBack,
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
  day,
  isoToday,
} from "./shared.tsx";
type Row = {
  id: string;
  name: string;
  academic_year_id?: string;
  starts_on: string;
  ends_on: string;
  start_year?: number;
  revision: number;
};
type Session = {
  id: string;
  term_id: string;
  title: string;
  description: string;
  starts_at_local: string;
  starts_at: string;
  duration_minutes: number;
  materials_folder_url: string | null;
  status: string;
  revision: number;
};
export function Sessions() {
  const years = useRead<Row[]>("/api/admin/academic-years");
  const terms = useRead<Row[]>("/api/admin/terms");
  const [year, setYear] = useState(""),
    [term, setTerm] = useState("");
  const actual =
    year ||
    years.data?.find(
      (y) =>
        y.starts_on.slice(0, 10) <= isoToday() &&
        y.ends_on.slice(0, 10) > isoToday(),
    )?.id ||
    years.data?.[0]?.id;
  return (
    <>
      <div className="dashboard-actions">
        <ActionLink href="/admin/sessions/new" variant="primary">
          Create session
        </ActionLink>
        <ActionLink href="/admin/sessions/calendar">
          Academic years and terms
        </ActionLink>
      </div>
      <Panel title="Sessions">
        <ReadState {...years} retry={years.refresh} />
        <ReadState {...terms} retry={terms.refresh} />
        <div className="dashboard-filters">
          <Filter
            id="session-year"
            label="Academic year"
            value={actual ?? ""}
            onChange={(value) => {
              setYear(value);
              setTerm("");
            }}
            options={years.data?.map((y) => [y.id, y.name]) ?? []}
            disabled={years.loading}
          />
          <Filter
            id="session-term"
            label="Term"
            value={term}
            onChange={setTerm}
            options={[
              ["", "All terms"],
              ...(terms.data
                ?.filter((t) => t.academic_year_id === actual)
                .map((t) => [t.id, t.name] as [string, string]) ?? []),
            ]}
            disabled={!actual || terms.loading}
          />
        </div>
        {actual ? (
          <SessionList
            key={`${actual}/${term}`}
            url={`/api/sessions?${term ? "termId=" + term : "academicYearId=" + actual}`}
          />
        ) : years.data ? (
          <p>No academic year configured.</p>
        ) : null}
      </Panel>
      <AbsenceQueue />
    </>
  );
}
function SessionList({ url }: { url: string }) {
  const read = useRead<Session[]>(url);
  return (
    <>
      <ReadState {...read} retry={read.refresh} />
      <ul className="admin-rows">
        {read.data?.map((s) => (
          <li key={s.id}>
            <RecordLink
              href={`/admin/sessions/${s.id}`}
              title={s.title}
              meta={
                <>
                  {day(s.starts_at)} · {sessionEditorDateTime(s.starts_at).time}{" "}
                  JST · {s.duration_minutes} minutes
                </>
              }
              status={s.status}
            />
          </li>
        ))}
      </ul>
      {read.data && !read.data.length ? (
        <p>No sessions in this selection.</p>
      ) : null}
    </>
  );
}
export function SessionEditor({ id }: { id: string }) {
  const fresh = id === "new";
  const read = useRead<Session>(
    fresh ? "/api/calendar" : "/api/sessions/" + id,
  );
  const terms = useRead<Row[]>("/api/admin/terms");
  const [pending, setPending] = useState(false),
    [dirty, setDirty] = useState(false),
    [message, setMessage] = useFeedback();
  const defaults = useRead<{
    start_time: string;
    duration_minutes: number;
    room: string;
    weekday: number;
  } | null>("/api/admin/recurring-meeting");
  const sessionForm = useRef<HTMLFormElement>(null);
  const [attendanceDirty, setAttendanceDirty] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [creationId] = useState(() => crypto.randomUUID());
  const s = fresh ? undefined : read.data;
  async function save(form: HTMLFormElement) {
    if (pending) return;
    const b = formValues(form);
    setPending(true);
    try {
      await adminRequest(
        fresh ? "/api/admin/sessions" : `/api/admin/sessions/${id}`,
        fresh ? "POST" : "PUT",
        {
          ...b,
          id: fresh ? creationId : id,
          revision: s?.revision,
          durationMinutes: Number(b.durationMinutes),
          materialsFolderUrl: b.materialsFolderUrl || null,
        },
      );
      setDirty(false);
      setMessage("Session saved.");
      if (fresh) setSavedId(creationId);
      else read.refresh();
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e
          : new Error("The request could not be completed."),
      );
    } finally {
      setPending(false);
    }
  }
  async function cancel() {
    if (
      !s ||
      pending ||
      !confirm("Cancel this session? Its attendance history will be preserved.")
    )
      return;
    setPending(true);
    try {
      await adminRequest(`/api/admin/sessions/${id}/cancel`, "POST", {
        revision: s.revision,
      });
      setMessage("Session cancelled.");
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
  }
  const local = s ? sessionEditorDateTime(s.starts_at) : undefined;
  return (
    <>
      <DraftGuard
        subject="unsaved session or attendance draft"
        dirty={dirty || attendanceDirty}
      />
      <AdminBack href="/admin/sessions">Session list</AdminBack>
      <Message>{message}</Message>
      {savedId ? (
        <ActionLink href={`/admin/sessions/${savedId}`}>
          Open saved session and attendance
        </ActionLink>
      ) : null}
      {!fresh ? (
        <ActionButton
          className="admin-utility"
          disabled={pending}
          onClick={() => {
            if (
              !dirty ||
              confirm(
                "Discard this session draft and reload the current session?",
              )
            ) {
              setDirty(false);
              read.refresh();
            }
          }}
        >
          <DashboardIcon name="refresh" /> Reload current session
        </ActionButton>
      ) : null}
      {!fresh ? <ReadState {...read} retry={read.refresh} /> : null}
      <ReadState {...terms} retry={terms.refresh} />
      {(fresh || s) && terms.data ? (
        <Panel
          title={fresh ? "Create session" : s!.title}
          description="Session times use Tokyo time. Attendance is managed separately below."
        >
          <p>
            Tokyo local time. Materials links do not grant Google Drive access.
          </p>
          {fresh && defaults.data ? (
            <>
              <p>
                Recurring default: {defaults.data.start_time.slice(0, 5)} JST,{" "}
                {defaults.data.duration_minutes} minutes
                {defaults.data.room ? `, ${defaults.data.room}` : ""}. Only
                start time and duration are copied; choose the session date
                explicitly.
              </p>
              <ActionButton
                disabled={pending}
                onClick={() => {
                  const form = sessionForm.current;
                  if (!form || !defaults.data) return;
                  const time = form.elements.namedItem(
                    "startTime",
                  ) as HTMLInputElement;
                  const duration = form.elements.namedItem(
                    "durationMinutes",
                  ) as HTMLInputElement;
                  time.value = defaults.data.start_time.slice(0, 5);
                  duration.value = String(defaults.data.duration_minutes);
                  setDirty(true);
                }}
              >
                Use recurring time defaults
              </ActionButton>
            </>
          ) : null}
          <AdminForm
            feedback={message}
            formRef={sessionForm}
            method="post"
            key={s?.revision ?? "new"}
            className="admin-form"
            onDirty={() => setDirty(true)}
            onSubmit={(e) => {
              e.preventDefault();
              void save(e.currentTarget);
            }}
          >
            <fieldset disabled={pending || !!savedId || attendanceDirty}>
              <Field
                name="termId"
                label="Term"
                required
                value={
                  s?.term_id ??
                  terms.data.find(
                    (t) =>
                      t.starts_on.slice(0, 10) <= isoToday() &&
                      t.ends_on.slice(0, 10) > isoToday(),
                  )?.id ??
                  terms.data[0]?.id
                }
                options={terms.data.map((t) => [
                  t.id,
                  `${t.name} (${day(t.starts_on)})`,
                ])}
              />
              <Field
                name="date"
                label="Session date"
                type="date"
                required
                value={local?.date ?? isoToday()}
              />
              <Field
                name="startTime"
                label="Start time (Tokyo)"
                type="time"
                required
                value={local?.time ?? "15:30"}
              />
              <Field
                name="durationMinutes"
                label="Duration in minutes"
                type="number"
                required
                value={s?.duration_minutes ?? 60}
              />
              <Field
                name="title"
                label="Title"
                required
                maxLength={120}
                value={s?.title}
              />
              <Field
                name="description"
                label="Description"
                type="textarea"
                maxLength={4000}
                value={s?.description}
              />
              <Field
                name="materialsFolderUrl"
                label="Materials folder"
                hint="Use a specific Google Drive folder link. Saving it does not change Drive access."
                type="url"
                value={s?.materials_folder_url ?? ""}
              />
              <div className="admin-save-bar admin-session-save">
                <div className="admin-session-state">
                  {s ? (
                    <>
                      <Status value={s.status} />
                      {s.status === "scheduled" ? (
                        <ActionButton
                          variant="danger"
                          disabled={pending || dirty || attendanceDirty}
                          onClick={cancel}
                        >
                          Cancel session
                        </ActionButton>
                      ) : null}
                    </>
                  ) : (
                    <span className="admin-hint">
                      {savedId
                        ? "Session saved"
                        : dirty
                          ? "Unsaved session changes"
                          : "New session"}
                    </span>
                  )}
                </div>
                <ActionButton
                  type="submit"
                  variant="primary"
                  disabled={!terms.data.length}
                >
                  {pending ? "Saving..." : "Save session"}
                </ActionButton>
              </div>
            </fieldset>
          </AdminForm>
        </Panel>
      ) : null}
      {!fresh ? (
        <Attendance
          key={id}
          id={id}
          sessionDirty={dirty}
          onDirty={setAttendanceDirty}
        />
      ) : null}
    </>
  );
}
function Attendance({
  id,
  sessionDirty,
  onDirty,
}: {
  id: string;
  sessionDirty: boolean;
  onDirty: (dirty: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const choices = [
    ["present", "Present"],
    ["late", "Late"],
    ["excused_absence", "Excused"],
    ["unexcused_absence", "Absent"],
  ] as const;
  const read = useRead<Awaited<ReturnType<typeof getSessionAttendance>>>(
    `/api/admin/sessions/${id}/attendance`,
  );
  const [marks, setMarks] = useState<
      Record<string, { status: string; notes: string }>
    >({}),
    [pending, setPending] = useState(false),
    [message, setMessage] = useFeedback();
  const dirty = Object.keys(marks).length > 0;
  useEffect(() => onDirty(dirty), [dirty, onDirty]);
  async function save() {
    const context = read.data;
    if (!context || pending || !dirty) return;
    setPending(true);
    try {
      const result = await adminRequest<{ sessionId: string }>(
        `/api/admin/sessions/${context.sessionId}/attendance`,
        "PUT",
        {
          revision: context.sessionRevision,
          records: Object.entries(marks).map(([memberId, value]) => ({
            memberId,
            ...value,
          })),
        },
      );
      if (result.sessionId !== id)
        throw new Error(
          "Saved response did not match this session. Reload before continuing.",
        );
      setMarks({});
      setMessage("Attendance saved. Loading a fresh roster.");
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
  }
  return (
    <Panel title="Attendance">
      <Message>{message}</Message>
      <ActionButton
        className="admin-utility"
        disabled={pending}
        onClick={() => {
          if (
            !dirty ||
            confirm("Discard unsaved marks and reload the current roster?")
          ) {
            setMarks({});
            read.refresh();
          }
        }}
      >
        <DashboardIcon name="refresh" /> Reload current roster
      </ActionButton>
      <ReadState
        {...read}
        retry={() => {
          if (
            !dirty ||
            confirm("Discard unsaved attendance and load the current roster?")
          ) {
            setMarks({});
            read.refresh();
          }
        }}
      />
      {read.data?.sessionId === id ? (
        <>
          <p>
            Choose one mark per student. Absent means an unexcused absence.
            Notes and absence notices are under Details; notices do not change
            final attendance automatically.
          </p>
          <Search
            value={query}
            onChange={setQuery}
            label="Find a student in this session"
          />
          <fieldset
            disabled={pending || sessionDirty}
            className="admin-attendance"
          >
            <legend className="sr-only">Session attendance roster</legend>
            <div className="admin-attendance-columns" aria-hidden="true">
              <span>Student</span>
              <div>
                {choices.map(([value, label]) => (
                  <span key={value}>{label}</span>
                ))}
              </div>
              <span>Details</span>
            </div>
            {read.data.roster
              .filter((r) =>
                r.displayName.toLowerCase().includes(query.toLowerCase()),
              )
              .map((r) => {
                const current = marks[r.memberId]?.status ?? r.status;
                const disabled =
                  pending ||
                  sessionDirty ||
                  (!r.attendanceRevision &&
                    (!r.eligible || read.data?.sessionStatus === "cancelled"));
                const update = (status: string, notes?: string) =>
                  setMarks((v) => ({
                    ...v,
                    [r.memberId]: {
                      status,
                      notes: notes ?? v[r.memberId]?.notes ?? r.notes ?? "",
                    },
                  }));
                return (
                  <div key={r.memberId} className="admin-attendance-row">
                    <div className="admin-attendance-student">
                      <Link href={`/admin/members/${r.memberId}`}>
                        {r.displayName}
                      </Link>
                      {current === "unmarked" ? (
                        <span className="admin-unmarked">Not marked</span>
                      ) : null}
                      {r.notices.length ? (
                        <span className="admin-notice-indicator">
                          {r.notices.length} absence{" "}
                          {r.notices.length === 1 ? "notice" : "notices"}
                        </span>
                      ) : null}
                    </div>
                    <fieldset
                      className="application-options admin-attendance-choices"
                      disabled={disabled}
                    >
                      <legend className="sr-only">
                        Attendance for {r.displayName}
                      </legend>
                      {choices.map(([value, label]) => (
                        <label
                          key={value}
                          title={
                            label === "Absent" ? "Unexcused absence" : label
                          }
                        >
                          <input
                            type="radio"
                            name={`attendance-${id}-${r.memberId}`}
                            value={value}
                            checked={current === value}
                            onChange={() => update(value)}
                          />
                          <span className="admin-attendance-choice-label">
                            {label}
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    <button
                      className="admin-attendance-details"
                      type="button"
                      aria-expanded={!!expanded[r.memberId]}
                      aria-controls={`attendance-details-${r.memberId}`}
                      onClick={() =>
                        setExpanded((v) => ({
                          ...v,
                          [r.memberId]: !v[r.memberId],
                        }))
                      }
                    >
                      <DashboardIcon name="right" />
                      <span className="sr-only">
                        Details for {r.displayName}
                      </span>
                    </button>
                    {expanded[r.memberId] ? (
                      <div
                        className="admin-attendance-expanded"
                        id={`attendance-details-${r.memberId}`}
                      >
                        {!r.eligible ? (
                          <p>
                            Outside this session's eligible membership period.
                            Existing marks can be corrected.
                          </p>
                        ) : null}
                        {r.notices.map(
                          (n: {
                            id: string;
                            reason: string;
                            status: string;
                          }) => (
                            <p key={n.id}>
                              <strong>Absence notice:</strong> {n.reason}{" "}
                              <Status value={n.status} />
                            </p>
                          ),
                        )}
                        <div className="admin-field">
                          <label htmlFor={`notes-${r.memberId}`}>
                            Private attendance note
                          </label>
                          <ApplicationInput
                            id={`notes-${r.memberId}`}
                            maxLength={256}
                            disabled={disabled}
                            value={marks[r.memberId]?.notes ?? r.notes ?? ""}
                            onChange={(e) => update(current, e.target.value)}
                          />
                        </div>
                        <ActionButton
                          disabled={disabled || current === "unmarked"}
                          onClick={() => update("unmarked")}
                        >
                          Clear mark
                        </ActionButton>
                      </div>
                    ) : null}
                  </div>
                );
              })}
          </fieldset>
          {!read.data.roster.length ? (
            <p>No eligible members or existing records for this session.</p>
          ) : query &&
            !read.data.roster.some((r) =>
              r.displayName.toLowerCase().includes(query.toLowerCase()),
            ) ? (
            <p className="admin-hint">
              No students match this search. Any changed marks remain ready to
              save.
            </p>
          ) : null}
          <div className="admin-save-bar">
            <span className="admin-hint">
              {Object.keys(marks).length} changed marks
              {sessionDirty ? " · Save or discard session edits first" : ""}
            </span>
            <ActionButton
              variant="primary"
              disabled={!dirty || pending || sessionDirty}
              onClick={save}
            >
              {pending ? "Saving attendance..." : "Save attendance"}
            </ActionButton>
          </div>
        </>
      ) : null}
    </Panel>
  );
}
export function CalendarSettings() {
  const years = useRead<Row[]>("/api/admin/academic-years"),
    terms = useRead<Row[]>("/api/admin/terms");
  const [kind, setKind] = useState("academic-years"),
    [selected, setSelected] = useState("new"),
    [message, setMessage] = useFeedback(),
    [pending, setPending] = useState(false),
    [dirty, setDirty] = useState(false);
  const rows = kind === "terms" ? terms.data : years.data;
  const current = rows?.find((r) => r.id === selected);
  const [creationId, setCreationId] = useState(() => crypto.randomUUID());
  return (
    <>
      <DraftGuard subject="unsaved draft" dirty={dirty} />
      <Panel title="Academic years and terms">
        <Message>{message}</Message>
        <ReadState {...years} retry={years.refresh} />
        <ReadState {...terms} retry={terms.refresh} />
        <div className="admin-filter-bar">
          <Filter
            id="calendar-kind"
            label="Configure"
            value={kind}
            disabled={pending || years.loading || terms.loading}
            onChange={(value) => {
              if (dirty && !confirm("Discard unsaved calendar changes?"))
                return;
              setDirty(false);
              setKind(value);
              setSelected("new");
              setCreationId(crypto.randomUUID());
            }}
            options={[
              ["academic-years", "Academic years"],
              ["terms", "Terms"],
            ]}
          />
          <Filter
            id="calendar-record"
            label="Record"
            value={selected}
            disabled={pending || years.loading || terms.loading}
            onChange={(value) => {
              if (dirty && !confirm("Discard unsaved calendar changes?"))
                return;
              setDirty(false);
              setSelected(value);
              setCreationId(crypto.randomUUID());
            }}
            options={[
              ["new", "Create new"],
              ...(rows?.map((row) => [row.id, row.name] as [string, string]) ??
                []),
            ]}
          />
        </div>
        <p>
          {kind === "terms"
            ? "Sessions can take place on the last day. Terms must fit their academic year."
            : "Choose the first and last day. Academic years cannot overlap."}
        </p>
        <AdminForm
          feedback={message}
          method="post"
          key={`${kind}/${selected}/${current?.revision}`}
          className="admin-form"
          onDirty={() => setDirty(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending) return;
            const b = formValues(e.currentTarget);
            setPending(true);
            try {
              await adminRequest(
                `/api/admin/${kind}`,
                current ? "PUT" : "POST",
                {
                  ...b,
                  id: current?.id ?? creationId,
                  revision: current?.revision,
                  endsOn: shiftCalendarDay(String(b.endsOn ?? ""), 1),
                  ...(kind === "academic-years"
                    ? { startYear: Number(b.startYear) }
                    : {}),
                },
              );
              setDirty(false);
              setMessage("Calendar record saved.");
              years.refresh();
              terms.refresh();
              setSelected(current?.id ?? creationId);
              setCreationId(crypto.randomUUID());
            } catch (error) {
              setMessage(
                error instanceof Error
                  ? error
                  : new Error("The request could not be completed."),
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <fieldset disabled={pending || years.loading || terms.loading}>
            <Field
              name="name"
              label="Name"
              value={current?.name}
              required
              maxLength={80}
            />
            {kind === "terms" ? (
              <Field
                name="academicYearId"
                label="Academic year"
                options={years.data?.map((y) => [y.id, y.name]) ?? []}
                value={current?.academic_year_id}
                required
              />
            ) : (
              <Field
                name="startYear"
                label="Start year"
                type="number"
                value={current?.start_year ?? new Date().getFullYear()}
                required
              />
            )}
            <Field
              name="startsOn"
              label="Starts on"
              type="date"
              value={current?.starts_on}
              required
            />
            <Field
              name="endsOn"
              label="Last day (included)"
              type="date"
              value={
                current
                  ? shiftCalendarDay(current.ends_on, -1)
                  : undefined
              }
              required
            />
            <div className="admin-save-bar">
              <span className="admin-hint">
                {dirty ? "Unsaved calendar changes" : ""}
              </span>
              <ActionButton type="submit" variant="primary">
                {pending ? "Saving..." : "Save calendar record"}
              </ActionButton>
            </div>
          </fieldset>
        </AdminForm>
      </Panel>
    </>
  );
}
function AbsenceQueue() {
  const [status, setStatus] = useState("submitted");
  const read = useRead<
    {
      id: string;
      display_name: string;
      session_id: string | null;
      session_date: string;
      reason: string;
      status: string;
      revision: number;
    }[]
  >("/api/admin/absences");
  const [pending, setPending] = useState(false),
    [message, setMessage] = useFeedback();
  return (
    <Panel title="Absence notices">
      <Filter
        id="absence-filter"
        label="Notice status"
        value={status}
        onChange={setStatus}
        options={[
          ["submitted", "Awaiting acknowledgement"],
          ["acknowledged", "Acknowledged"],
          ["cancelled", "Cancelled"],
          ["all", "All notices"],
        ]}
      />
      <Message>{message}</Message>
      <ReadState {...read} retry={read.refresh} />
      <ul className="admin-rows">
        {read.data
          ?.filter((n) => status === "all" || n.status === status)
          .map((n) => (
            <li key={n.id}>
              <strong>
                {n.display_name} · {day(n.session_date)}
              </strong>
              <p>{n.reason}</p>
              <Status value={n.status} />
              {n.session_id ? (
                <ActionLink href={`/admin/sessions/${n.session_id}`}>
                  Open session
                </ActionLink>
              ) : (
                <span>Standalone date notice</span>
              )}
              {n.status === "submitted" ? (
                <ActionButton
                  disabled={pending}
                  onClick={async () => {
                    if (pending) return;
                    setPending(true);
                    try {
                      await adminRequest(
                        `/api/admin/absences/${n.id}/acknowledge`,
                        "POST",
                        { revision: n.revision },
                      );
                      setMessage(
                        "Notice acknowledged. Final attendance is unchanged.",
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
                  Acknowledge notice
                </ActionButton>
              ) : null}
            </li>
          ))}
      </ul>
      {read.data &&
      !read.data.some((n) => status === "all" || n.status === status) ? (
        <p className="admin-hint">No absence notices in this view.</p>
      ) : null}
    </Panel>
  );
}

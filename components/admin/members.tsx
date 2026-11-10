"use client";
import { DashboardIcon } from "../dashboard/icon.tsx";
import { useState } from "react";
import { ActionButton, ActionLink } from "../action.tsx";
import { ApplicationAnswers } from "../application-answers.tsx";
import type { OwnApplication } from "../../src/applications/presentation.ts";
import type {
  listMembers,
  getAdminMemberDetail,
} from "../../src/membership/operations.ts";
import { adminRequest } from "../../src/admin/request.ts";
import { DraftGuard } from "../dashboard/draft-guard.tsx";
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
  day,
  formValues,
  gradeOptions,
  isoToday,
} from "./shared.tsx";
export function Members() {
  const [status, setStatus] = useState("active");
  const [query, setQuery] = useState("");
  const read = useRead<Awaited<ReturnType<typeof listMembers>>>(
    `/api/admin/members?status=${status}`,
  );
  return (
    <Panel title="Member roster">
      <div className="admin-filter-bar">
        <Filter
          id="roster-filter"
          label="Membership status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setQuery("");
          }}
          options={[
            ["active", "Active members"],
            ["paused", "Paused members"],
            ["former", "Former members"],
          ]}
        />
        <Search value={query} onChange={setQuery} label="Find a member" />
      </div>
      <ReadState {...read} retry={read.refresh} />
      <ul className="admin-rows">
        {read.data
          ?.filter((m) =>
            m.display_name.toLowerCase().includes(query.toLowerCase()),
          )
          .map((m) => (
            <li key={m.id}>
              <RecordLink
                href={`/admin/members/${m.id}`}
                title={m.display_name}
                meta={
                  <>
                    {m.currentGrade === null
                      ? "Past Grade 12"
                      : `Grade ${m.currentGrade}`}{" "}
                    · Since {day(m.state_since)}
                    {m.departure_reason ? ` · ${m.departure_reason}` : ""}
                  </>
                }
                status={m.status}
              />
            </li>
          ))}
      </ul>
      {read.data && !read.data.length ? (
        <p>No members in this view.</p>
      ) : read.data &&
        query &&
        !read.data.some((m) =>
          m.display_name.toLowerCase().includes(query.toLowerCase()),
        ) ? (
        <p className="admin-hint">No members match this search.</p>
      ) : null}
    </Panel>
  );
}
export function MemberDetail({ id }: { id: string }) {
  const read = useRead<Awaited<ReturnType<typeof getAdminMemberDetail>>>(
    `/api/admin/members/${id}`,
  );
  const [pending, setPending] = useState(false),
    [message, setMessage] = useFeedback(),
    [dirty, setDirty] = useState(false),
    [state, setState] = useState("active");
  const [editing, setEditing] = useState<"card" | "state" | null>(null);
  const m = read.data?.member;
  async function save(form: HTMLFormElement, changeState = false) {
    if (!m || pending) return;
    const values = formValues(form);
    if (
      changeState &&
      !confirm(
        "Apply this dated membership change? Historical attendance is preserved.",
      )
    )
      return;
    setPending(true);
    try {
      await adminRequest(
        `/api/admin/members/${id}${changeState ? "/state" : ""}`,
        changeState ? "POST" : "PUT",
        changeState
          ? {
              revision: m.revision,
              effectiveOn: values.effectiveOn,
              status: state,
              ...(state === "former"
                ? { departureReason: values.departureReason }
                : {}),
            }
          : {
              ...values,
              revision: m.revision,
              grade: Number(values.grade),
              gradeAcademicYear: Number(values.gradeAcademicYear),
            },
      );
      setDirty(false);
      setEditing(null);
      setMessage("Member record saved.");
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
    <>
      <DraftGuard subject="unsaved draft" dirty={dirty} />
      <AdminBack href="/admin/members">Member roster</AdminBack>
      <Message>{message}</Message>
      <ActionButton
        className="admin-utility"
        disabled={pending}
        onClick={() => {
          if (
            !dirty ||
            confirm(
              "Discard unsaved member changes and reload the current record?",
            )
          ) {
            setDirty(false);
            setEditing(null);
            read.refresh();
          }
        }}
      >
        <DashboardIcon name="refresh" /> Reload current member
      </ActionButton>
      <ReadState {...read} retry={read.refresh} />
      {m && read.data ? (
        <>
          <Panel title={m.display_name}>
            <div className="admin-record-context">
              <span className="admin-account-email">{m.email}</span>
              <Status value={m.status} />
              {m.departure_reason ? <span>{m.departure_reason}</span> : null}
            </div>
            <p>
              Current grade: {m.currentGrade ?? "Past Grade 12"}. Grades
              progress on August 1 in Tokyo. The grade and academic year below
              are the manual baseline.
            </p>
            <AdminForm
              feedback={message}
              method="post"
              key={m.revision}
              className="admin-form"
              onDirty={() => {
                setDirty(true);
                setEditing("card");
              }}
              onSubmit={(e) => {
                e.preventDefault();
                void save(e.currentTarget);
              }}
            >
              <fieldset disabled={pending || editing === "state"}>
                <Field
                  name="displayName"
                  label="Display name"
                  value={m.display_name}
                  required
                  maxLength={80}
                />
                <Field
                  name="grade"
                  label="Baseline grade"
                  value={m.grade}
                  options={gradeOptions}
                />
                <Field
                  name="gradeAcademicYear"
                  label="Grade academic year (start year)"
                  type="number"
                  value={m.grade_academic_year}
                  required
                />
                <Field
                  name="privateNotes"
                  label="Private admin notes"
                  type="textarea"
                  value={read.data.private.notes}
                  maxLength={4000}
                />
                <ActionButton type="submit" variant="primary">
                  {pending ? "Saving..." : "Save member card"}
                </ActionButton>
              </fieldset>
            </AdminForm>
          </Panel>
          <Panel
            title="Membership status"
            description="Use an effective date to pause membership or record a departure. Historical attendance is preserved."
          >
            <AdminForm
              feedback={message}
              method="post"
              className="admin-form"
              onDirty={() => {
                setDirty(true);
                setEditing("state");
              }}
              onSubmit={(e) => {
                e.preventDefault();
                void save(e.currentTarget, true);
              }}
            >
              <fieldset disabled={pending || editing === "card"}>
                <Filter
                  id="membership-state"
                  label="New status"
                  value={state}
                  onChange={setState}
                  options={[
                    ["active", "Active"],
                    ["paused", "Paused"],
                    ["former", "Former"],
                  ]}
                />
                {state === "former" ? (
                  <Field
                    name="departureReason"
                    label="Departure reason"
                    options={["graduated", "quit", "removed"].map((s) => [
                      s,
                      s,
                    ])}
                  />
                ) : null}
                <Field
                  name="effectiveOn"
                  label="Effective date"
                  type="date"
                  value={isoToday()}
                  required
                />
                <ActionButton
                  type="submit"
                  variant={state === "former" ? "danger" : "primary"}
                >
                  {pending ? "Saving..." : "Save membership status"}
                </ActionButton>
              </fieldset>
            </AdminForm>
          </Panel>
          <Panel title="Attendance and history">
            <p>
              {read.data.attendance.eligibleSessions === 0
                ? "No eligible attendance records"
                : read.data.attendance.percentage === null
                  ? "No settled percentage"
                  : `${read.data.attendance.percentage}% attendance`}
            </p>
            <p>Correct attendance inside the relevant session.</p>
            <ul className="admin-rows">
              {read.data.records.map((r) => (
                <li key={r.session_id}>
                  <ActionLink href={`/admin/sessions/${r.session_id}`}>
                    {r.title}
                  </ActionLink>
                  <span>
                    {day(r.starts_at)} · {r.status.replaceAll("_", " ")}
                  </span>
                </li>
              ))}
            </ul>
            <h3>Membership periods</h3>
            <ul>
              {read.data.periods.map((p, i) => (
                <li key={i}>
                  {day(p.starts_on)} to {p.ends_on ? day(p.ends_on) : "Present"}{" "}
                  · {p.status}
                  {p.departure_reason ? " - " + p.departure_reason : ""}
                </li>
              ))}
            </ul>
            {read.data.history.length ? (
              <ul className="admin-rows">
                {read.data.history.map((h, i) => (
                  <li key={i}>
                    {day(h.recorded_at)} ·{" "}
                    {String(h.action)
                      .replaceAll(".", " / ")
                      .replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No changes recorded.</p>
            )}
          </Panel>
          <Panel title="Applications">
            {read.data.applications.length ? (
              read.data.applications.map((a) => (
                <div key={a.id}>
                  <ApplicationAnswers application={a as OwnApplication} />
                  <ActionLink href={`/admin/applications/${a.id}`}>
                    Application review
                  </ActionLink>
                </div>
              ))
            ) : (
              <p>
                This member has no application record. Imported members may have
                no application.
              </p>
            )}
          </Panel>
        </>
      ) : null}
    </>
  );
}

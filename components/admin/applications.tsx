"use client";
import { DashboardIcon } from "../dashboard/icon.tsx";
import { useState } from "react";
import { ActionButton, ActionLink } from "../action.tsx";
import { ApplicationAnswers } from "../application-answers.tsx";
import type { OwnApplication } from "../../src/applications/presentation.ts";
import type {
  getAdminApplicationDetail,
  listApplicationQueue,
} from "../../src/applications/review.ts";
import { adminRequest } from "../../src/admin/request.ts";
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
  isoToday,
  formValues,
  gradeOptions,
} from "./shared.tsx";
import { DraftGuard } from "../dashboard/draft-guard.tsx";
export function Applications() {
  const [status, setStatus] = useState("submitted");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const read = useRead<Awaited<ReturnType<typeof listApplicationQueue>>>(
    `/api/admin/applications?status=${status}&offset=${offset}`,
  );
  return (
    <Panel title="Application queue">
      <div className="admin-filter-bar">
        <Filter
          id="application-status"
          label="Review status"
          value={status}
          onChange={(value) => {
            setStatus(value);
            setOffset(0);
            setQuery("");
          }}
          options={[
            ["submitted", "Submitted"],
            ["under_review", "Under review"],
            ["accepted", "Accepted"],
            ["rejected", "Rejected"],
            ["withdrawn", "Withdrawn"],
            ["all", "All applications"],
          ]}
        />
        <Search value={query} onChange={setQuery} label="Search this page" />
      </div>
      <ReadState {...read} retry={read.refresh} />
      {read.data ? (
        <>
          <ul className="admin-rows">
            {read.data
              .filter((a) =>
                `${a.preferred_name} ${a.email}`
                  .toLowerCase()
                  .includes(query.toLowerCase()),
              )
              .map((a) => (
                <li key={a.id}>
                  <RecordLink
                    href={`/admin/applications/${a.id}`}
                    title={a.preferred_name}
                    meta={
                      <>
                        {a.email} · Grade {a.grade} · {day(a.submitted_at)}
                      </>
                    }
                    status={a.status}
                  />
                </li>
              ))}
          </ul>
          {!read.data.length ? (
            <p>No applications in this view.</p>
          ) : query &&
            !read.data.some((a) =>
              `${a.preferred_name} ${a.email}`
                .toLowerCase()
                .includes(query.toLowerCase()),
            ) ? (
            <p className="admin-hint">
              No applications match this search on the current page.
            </p>
          ) : null}
          <div className="admin-pagination">
            <span className="admin-hint">
              Page {offset / 50 + 1} · {read.data.length} applications loaded
            </span>
            <ActionButton
              disabled={!offset}
              onClick={() => setOffset((v) => Math.max(0, v - 50))}
            >
              Previous
            </ActionButton>
            <ActionButton
              disabled={read.data.length < 50 || offset >= 10000}
              onClick={() => setOffset((v) => v + 50)}
            >
              Next
            </ActionButton>
          </div>
        </>
      ) : null}
    </Panel>
  );
}
export function ApplicationDetail({ id }: { id: string }) {
  const read = useRead<Awaited<ReturnType<typeof getAdminApplicationDetail>>>(
    `/api/admin/applications/${id}`,
  );
  const [accept, setAccept] = useState(false),
    [pending, setPending] = useState(false),
    [message, setMessage] = useFeedback(),
    [dirty, setDirty] = useState(false);
  const a = read.data?.application;
  async function transition(status: string) {
    if (!a || pending) return;
    if (
      status === "rejected" &&
      !confirm(
        "Reject this application? Reapplication restrictions are separate.",
      )
    )
      return;
    setPending(true);
    try {
      await adminRequest(`/api/admin/applications/${id}/status`, "POST", {
        revision: a.revision,
        status,
      });
      setMessage("Review status saved.");
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
  async function save(form: HTMLFormElement) {
    if (!a || pending) return;
    const b = formValues(form);
    setPending(true);
    try {
      await adminRequest<string>(
        `/api/admin/applications/${id}/accept`,
        "POST",
        {
          revision: a.revision,
          memberCard: {
            ...b,
            grade: Number(b.grade),
            gradeAcademicYear: Number(b.gradeAcademicYear),
          },
        },
      );
      setDirty(false);
      setAccept(false);
      setMessage("Application accepted and member card created.");
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
      <AdminBack href="/admin/applications">Application queue</AdminBack>
      <ReadState {...read} retry={read.refresh} />
      <Message>{message}</Message>
      <ActionButton
        className="admin-utility"
        disabled={pending}
        onClick={() => {
          if (
            !dirty ||
            confirm(
              "Discard this acceptance draft and reload the current application?",
            )
          ) {
            setDirty(false);
            setAccept(false);
            read.refresh();
          }
        }}
      >
        <DashboardIcon name="refresh" /> Reload current application
      </ActionButton>
      {a ? (
        <>
          <Panel title={String(a.preferred_name)}>
            <div className="admin-record-context">
              <span className="admin-account-email">{a.email}</span>
              <Status value={a.status} />
              <span>
                Submitted{" "}
                <time dateTime={String(a.submitted_at)}>
                  {day(a.submitted_at)}
                </time>
              </span>
            </div>
            <ApplicationAnswers application={a as OwnApplication} />
            {a.status_reason ? (
              <p>Private review reason: {a.status_reason}</p>
            ) : null}
            <h3>Reapplication restrictions</h3>
            {read.data?.restrictions.length ? (
              <ul>
                {read.data.restrictions.map((r) => (
                  <li key={r.id}>
                    {r.reason} · {day(r.starts_at)} to{" "}
                    {r.ends_at ? day(r.ends_at) : "No end set"}
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No restriction recorded. Rejection alone is not a permanent ban.
              </p>
            )}
            {a.member_id ? (
              <ActionLink href={`/admin/members/${a.member_id}`}>
                Open member record
              </ActionLink>
            ) : null}
            {["submitted", "under_review"].includes(String(a.status)) ? (
              <div className="dashboard-actions">
                <ActionButton
                  disabled={pending || accept || a.status === "under_review"}
                  onClick={() => transition("under_review")}
                >
                  Mark under review
                </ActionButton>
                <ActionButton
                  disabled={pending || accept}
                  variant="primary"
                  onClick={() => setAccept(true)}
                >
                  Review acceptance
                </ActionButton>
                <ActionButton
                  variant="danger"
                  disabled={pending || accept}
                  onClick={() => transition("rejected")}
                >
                  Reject
                </ActionButton>
              </div>
            ) : null}
          </Panel>
          {accept ? (
            <Panel
              title="Review member card"
              description="Acceptance grants member access from the membership start date."
            >
              <p>
                Review the member card below before accepting. Acceptance and
                membership creation are saved together.
              </p>
              <AdminForm
                feedback={message}
                method="post"
                className="admin-form"
                onDirty={() => setDirty(true)}
                onSubmit={(e) => {
                  e.preventDefault();
                  void save(e.currentTarget);
                }}
              >
                <fieldset disabled={pending}>
                  <Field
                    name="displayName"
                    label="Display name"
                    value={String(a.preferred_name)}
                    required
                    maxLength={80}
                  />
                  <Field
                    name="grade"
                    label="Grade"
                    value={a.grade}
                    options={gradeOptions}
                  />
                  <Field
                    name="gradeAcademicYear"
                    label="Grade academic year (start year)"
                    type="number"
                    value={a.grade_academic_year}
                    required
                  />
                  <Field
                    name="startsOn"
                    label="Membership start date"
                    type="date"
                    value={isoToday()}
                    required
                  />
                  <Field
                    name="privateNotes"
                    label="Private admin notes"
                    type="textarea"
                    maxLength={4000}
                  />
                  <ActionButton type="submit" variant="primary">
                    {pending ? "Confirming..." : "Confirm acceptance"}
                  </ActionButton>
                  <ActionButton
                    type="button"
                    onClick={() => {
                      if (!dirty || confirm("Discard the member-card draft?")) {
                        setAccept(false);
                        setDirty(false);
                      }
                    }}
                  >
                    Cancel review
                  </ActionButton>
                </fieldset>
              </AdminForm>
            </Panel>
          ) : null}
        </>
      ) : null}
    </>
  );
}

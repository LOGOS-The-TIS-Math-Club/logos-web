"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { ActionButton, ActionLink } from "../action.tsx";
import { ApplicationSelect } from "../application-select.tsx";
import { DraftGuard } from "./draft-guard.tsx";
import { DatePicker } from "./date-picker.tsx";
import { DashboardIcon } from "./icon.tsx";
import type { PersonalData, Session } from "../../src/dashboard/types.ts";
import {
  dashboardRequest,
  DashboardRequestError,
} from "../../src/dashboard/request.ts";
import { sessionInfo } from "../../src/dashboard/session.ts";
import { displayDay, tokyoDay } from "../../src/dashboard/presentation.ts";
type Attempt = {
  requestId: string;
  reason: string;
  sessionId?: string;
  sessionDate?: string;
};
export function AbsenceForm({
  identityId,
  sessions,
  onDirty,
  onRecords,
  guardNavigation = true,
}: {
  identityId: string;
  sessions: Session[];
  onDirty: (dirty: boolean) => void;
  onRecords: (records: PersonalData) => void;
  guardNavigation?: boolean;
}) {
  const [mode, setMode] = useState<"session" | "date">("session");
  const [selected, setSelected] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [extra, setExtra] = useState<Session | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [mayRetry, setMayRetry] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [targetLoading, setTargetLoading] = useState(false);
  const lock = useRef(false);
  const attempt = useRef<Attempt | null>(null);
  const alert = useRef<HTMLDivElement>(null);
  const dirty = Boolean(reason || selected || date || uncertain);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty]);
  useEffect(() => {
    setInteractive(true);
    const query = new URLSearchParams(location.search).get("absenceSession");
    if (!query || !z.uuid().safeParse(query).success) return;
    const controller = new AbortController();
    setTargetLoading(true);
    dashboardRequest<Record<string, any>>(
      `/api/sessions/${query}`,
      undefined,
      controller.signal,
    )
      .then((row) => {
        if (!controller.signal.aborted) {
          setExtra(sessionInfo(row));
          setSelected(query);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(
            "The requested session could not be loaded. Choose a session or enter a date.",
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setTargetLoading(false);
      });
    return () => controller.abort();
  }, []);
  const options = [
    ...new Map(
      [...sessions, ...(extra ? [extra] : [])].map((session) => [
        session.id,
        session,
      ]),
    ).values(),
  ].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  function report(text: string) {
    setError(text);
    setTimeout(() => alert.current?.focus(), 0);
  }
  function changed() {
    setError("");
    setMessage("");
    if (!uncertain) attempt.current = null;
  }
  async function reconcile() {
    const records = await dashboardRequest<PersonalData>(
      "/api/dashboard/records",
    );
    if (records.identityId !== identityId) {
      report(
        "The signed-in account changed. Nothing will be resent. Open your account before continuing.",
      );
      setMayRetry(false);
      return;
    }
    if (records.notices.status !== "available" || !records.notices.data)
      throw new Error("Notices unavailable");
    onRecords(records);
    const saved = records.notices.data.find(
      (notice) => notice.id === attempt.current?.requestId,
    );
    if (saved) {
      setMessage(
        saved.status === "cancelled"
          ? "This notice was received and has since been cancelled. It was not submitted again."
          : "Your absence notice was received. Final attendance has not been changed automatically.",
      );
      setError("");
      setReason("");
      setSelected("");
      setDate("");
      setUncertain(false);
      setMayRetry(false);
      attempt.current = null;
      return;
    }
    if (
      attempt.current?.sessionId &&
      records.notices.data.some(
        (notice) =>
          notice.sessionId === attempt.current!.sessionId &&
          notice.status !== "cancelled",
      )
    ) {
      report(
        "An absence notice is already on file for this session. Review your records before starting a new notice. Your draft has been kept.",
      );
      setMayRetry(false);
      return;
    }
    setMayRetry(true);
    report(
      "No saved notice was found for this submission. Check again or retry the same notice. Your reason has been kept.",
    );
  }
  async function check() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await reconcile();
    } catch {
      report(
        "Your notice status could not be checked. Keep this page open and try again.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function submit() {
    if (lock.current || (uncertain && !mayRetry)) return;
    if (!attempt.current) {
      if (!reason.trim() || reason.trim().length > 500) {
        report("Enter a reason of 1-500 characters.");
        return;
      }
      if (mode === "session" && !selected) {
        report("Choose a session, or use a date instead.");
        return;
      }
      if (mode === "date" && !z.iso.date().safeParse(date).success) {
        report("Enter a valid absence date.");
        return;
      }
      attempt.current = {
        requestId: crypto.randomUUID(),
        reason: reason.trim(),
        ...(mode === "session"
          ? { sessionId: selected }
          : { sessionDate: date }),
      };
    }
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    let sent = false,
      posted = false;
    try {
      const user = await dashboardRequest<{ id: string }>("/api/me");
      if (user.id !== identityId) {
        report(
          "The signed-in account changed. Nothing was sent. Open your account before continuing.",
        );
        return;
      }
      sent = true;
      await dashboardRequest("/api/me/absences", attempt.current);
      posted = true;
      setUncertain(true);
      setMayRetry(false);
      await reconcile();
    } catch (failure) {
      if (
        failure instanceof DashboardRequestError &&
        failure.status < 500 &&
        !posted &&
        !uncertain &&
        failure.status !== 409
      ) {
        attempt.current = null;
        report(
          failure.status === 401
            ? "Your session expired. Your reason is still here. Sign in in another tab, then retry."
            : failure.status === 403
              ? "Your account cannot submit an absence notice. Your draft has been kept."
              : "The notice was not saved. Check the session or date and your reason. Your draft has been kept.",
        );
      } else if (sent || posted || uncertain) {
        setUncertain(true);
        setMayRetry(false);
        report(
          "The result is uncertain. Check notice status before trying again. Your reason has been kept.",
        );
        try {
          await reconcile();
        } catch {
          /* Keep the original ID and reason until a read confirms the result. */
        }
      } else
        report(
          "Your account could not be checked. Nothing was sent. Your draft has been kept.",
        );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  const disabled = !interactive || busy || uncertain || targetLoading;
  return (
    <section
      id="absence"
      className="home-panel dashboard-absence"
      aria-labelledby="absence-heading"
    >
      <div className="dashboard-section-heading">
        <div className="dashboard-section-title">
          <span className="dashboard-section-icon">
            <DashboardIcon name="report" />
          </span>
          <h2 id="absence-heading">Report an absence</h2>
        </div>
      </div>
      <p className="dashboard-section-description">
        Let leadership know when you can't attend.
      </p>
      {message ? (
        <p role="status" className="notice">
          {message}
        </p>
      ) : null}
      {error ? (
        <div ref={alert} role="alert" tabIndex={-1} className="notice">
          <p>{error}</p>
          <ActionLink
            href="/auth/sign-in"
            target="_blank"
            rel="noopener"
            variant="quiet"
          >
            Open account in another tab
          </ActionLink>
        </div>
      ) : null}
      <form
        method="post"
        action="/api/me/absences"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="dashboard-notice-form"
      >
        <fieldset disabled={disabled} className="dashboard-notice-fields">
          <legend className="sr-only">Absence notice</legend>
          <div
            className="dashboard-notice-mode"
            role="group"
            aria-label="Absence report type"
          >
            <button
              type="button"
              aria-pressed={mode === "session"}
              onClick={() => {
                setMode("session");
                changed();
              }}
            >
              Scheduled session
            </button>
            <button
              type="button"
              aria-pressed={mode === "date"}
              onClick={() => {
                setMode("date");
                changed();
              }}
            >
              Another date
            </button>
          </div>
          {mode === "session" ? (
            <div className="dashboard-field">
              <label id="absence-session-label" htmlFor="absence-session">
                Session
              </label>
              <p id="absence-session-hint" className="sr-only">
                Choose from the loaded sessions, or enter a date if yours is not
                listed.
              </p>
              <ApplicationSelect
                id="absence-session"
                name="sessionId"
                placeholder="Choose a session"
                value={selected}
                options={options.map((session) => [
                  session.id,
                  `${displayDay(tokyoDay(session.startsAt))} - ${session.title}${session.status === "cancelled" ? " (cancelled)" : ""}`,
                ])}
                describedBy="absence-session-hint"
                disabled={disabled}
                onValueChange={(value) => {
                  setSelected(value);
                  changed();
                }}
              />
            </div>
          ) : (
            <div className="dashboard-field">
              <label id="absence-date-label" htmlFor="absence-date">
                Absence date
              </label>
              <DatePicker
                id="absence-date"
                value={date}
                disabled={disabled}
                onChange={(value) => {
                  setDate(value);
                  changed();
                }}
              />
            </div>
          )}
          <div className="dashboard-field">
            <label htmlFor="absence-reason">Reason</label>
            <p id="absence-reason-hint" className="small muted">
              Only you and leadership can see this.
            </p>
            <textarea
              id="absence-reason"
              name="reason"
              value={reason}
              rows={3}
              placeholder="Briefly explain why you'll be absent."
              maxLength={500}
              required
              aria-describedby="absence-reason-hint"
              onChange={(event) => {
                setReason(event.target.value);
                changed();
              }}
            />
          </div>
        </fieldset>
        <div className="dashboard-actions dashboard-notice-submit">
          {uncertain ? (
            <>
              <ActionButton
                disabled={!interactive || busy}
                onClick={() => void check()}
              >
                Check notice status
              </ActionButton>
              {mayRetry ? (
                <ActionButton
                  variant="primary"
                  disabled={busy}
                  onClick={() => void submit()}
                >
                  Retry same notice
                </ActionButton>
              ) : null}
            </>
          ) : (
            <ActionButton variant="primary" type="submit" disabled={disabled}>
              <DashboardIcon name="report" />
              {busy ? "Sending..." : "Send absence report"}
            </ActionButton>
          )}
        </div>
        <p className="dashboard-footnote">
          A report informs leadership; it does not automatically change your
          attendance. Unsaved drafts stay on this page only.
        </p>
        {busy ? (
          <p role="status">Checking and saving your notice...</p>
        ) : targetLoading ? (
          <p role="status">Loading the requested session...</p>
        ) : null}
      </form>
      {guardNavigation ? <DraftGuard dirty={dirty} /> : null}
    </section>
  );
}

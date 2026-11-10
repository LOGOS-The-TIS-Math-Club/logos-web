"use client";
import { useEffect, useRef, useState } from "react";
import { ActionLink, ActionButton } from "./action.tsx";
import { ApplicationForm } from "./application-form.tsx";
import { ApplicationAnswers } from "./application-answers.tsx";
import {
  applicationRequest,
  ApplicationRequestError,
} from "../src/applications/request.ts";
import { statusLabels } from "../src/applications/presentation.ts";
import type {
  ApplicationEntry,
  ApplyState,
  OwnApplication,
} from "../src/applications/presentation.ts";
import { formatDisplayDate } from "../src/presentation/date.ts";

export function ApplyPanel({ initial }: { initial: ApplyState }) {
  const [state, setState] = useState(initial);
  const [newApplication, setNewApplication] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [interactive, setInteractive] = useState(false);
  useEffect(() => {
    setInteractive(true);
  }, []);
  const [confirmWithdrawal, setConfirmWithdrawal] =
    useState<OwnApplication | null>(null);
  const [notice, setNotice] = useState("");
  const [readFailed, setReadFailed] = useState(false);
  const reads = useRef<AbortController | null>(null);
  const mutation = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const entry = state.status === "ready" ? state.entry : null;
  const showForm = Boolean(
    entry &&
    (newApplication ||
      (!entry.applications.length && !entry.blockedBy && entry.academicYear)),
  );

  function updated(value: ApplicationEntry, message: string) {
    setState({ status: "ready", entry: value });
    setNewApplication(false);
    setConfirmWithdrawal(null);
    setReadFailed(false);
    setNotice(message);
    setTimeout(() => heading.current?.focus(), 0);
  }

  async function reload() {
    if (mutation.current) return;
    reads.current?.abort();
    const controller = new AbortController();
    reads.current = controller;
    setLoading(true);
    try {
      const value = await applicationRequest<ApplicationEntry>(
        "/api/me/applications/entry",
        undefined,
        AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
      );
      if (!controller.signal.aborted) {
        setState({ status: "ready", entry: value });
        setReadFailed(false);
        setConfirmWithdrawal((previous) =>
          previous &&
          value.applications.some(
            (item) =>
              item.id === previous.id &&
              item.revision === previous.revision &&
              item.canWithdraw,
          )
            ? previous
            : null,
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        if (
          error instanceof ApplicationRequestError &&
          (error.status === 401 || error.status === 403)
        )
          setState({ status: error.status === 401 ? "anonymous" : "denied" });
        else setReadFailed(true);
      }
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    if (showForm || initial.status === "unconfigured") return;
    const restore = () => {
      void reload();
    };
    restore();
    window.addEventListener("focus", restore);
    window.addEventListener("pageshow", restore);
    return () => {
      reads.current?.abort();
      window.removeEventListener("focus", restore);
      window.removeEventListener("pageshow", restore);
    };
  }, [showForm, initial.status]);

  async function withdraw(application: OwnApplication) {
    if (mutation.current) return;
    reads.current?.abort();
    mutation.current = true;
    setLoading(false);
    setPending(true);
    setNotice("");
    try {
      await applicationRequest(
        `/api/me/applications/${application.id}/withdraw`,
        { revision: application.revision },
      );
      setNotice("Your application was withdrawn.");
      setConfirmWithdrawal(null);
    } catch (error) {
      setNotice(
        error instanceof ApplicationRequestError && error.status === 409
          ? "The application changed before withdrawal. Review its refreshed status before trying again."
          : "Withdrawal could not be confirmed. Check the refreshed status before trying again.",
      );
      setConfirmWithdrawal(null);
    } finally {
      mutation.current = false;
      setPending(false);
      await reload();
    }
  }

  const latest = entry?.applications[0];
  return (
    <div className="application-page">
      <div className="application-heading">
        <p className="eyebrow">LOGOS / APPLICATION</p>
        <h1 ref={heading} tabIndex={-1}>
          Apply to LOGOS
        </h1>
        <p className="intro muted">
          For Tokyo International School students in Grades 9-12. Prior
          competition experience is not required.
        </p>
      </div>
      {notice ? (
        <p role="status" className="notice">
          {notice}
        </p>
      ) : null}
      {readFailed ? (
        <div role="alert" className="notice">
          <p>
            Current application data is unavailable. Any status below was last
            loaded earlier.
          </p>
          <ActionButton
            disabled={!interactive || loading}
            onClick={() => void reload()}
          >
            Retry status
          </ActionButton>
        </div>
      ) : null}
      {loading ? (
        <p role="status">Checking your application status...</p>
      ) : null}
      {!entry ? (
        <section className="home-panel">
          {state.status === "unconfigured" ? (
            <>
              <h2>School sign-in is unavailable</h2>
              <p>
                Sign-in is not configured for this environment. Applications
                cannot be submitted here yet.
              </p>
            </>
          ) : state.status === "anonymous" ? (
            <>
              <h2>Start with your school account</h2>
              <p>
                Sign in with your verified @tokyois.com Google account to apply
                or view your own application.
              </p>
            </>
          ) : state.status === "denied" ? (
            <>
              <h2>School account access required</h2>
              <p>
                This account cannot access applications. Check your account or
                sign in with your verified school Google account.
              </p>
            </>
          ) : (
            <>
              <h2>Applications are temporarily unavailable</h2>
              <p>
                Your account or application could not be checked. Please retry.
              </p>
              <ActionButton
                disabled={!interactive || loading}
                onClick={() => void reload()}
              >
                Retry
              </ActionButton>
            </>
          )}
          <div className="application-actions">
            <ActionLink href="/auth/sign-in?returnTo=%2Fapply">
              {state.status === "anonymous"
                ? "Sign in to apply"
                : "Open account"}
            </ActionLink>
          </div>
        </section>
      ) : (
        <>
          {!showForm ? (
            <>
              <p className="small muted application-email">
                School account: {entry.email}
              </p>
              {entry.blockedBy === "current_member" ? (
                <section className="home-panel">
                  <h2>You are already a current member</h2>
                  <p>
                    A new application is not needed for active or paused
                    membership. Your previous applications, if any, remain
                    below.
                  </p>
                  <p className="muted small">
                    The member dashboard is not available yet.
                  </p>
                </section>
              ) : null}
              {latest ? (
                <section
                  className="home-panel application-status"
                  aria-labelledby="application-status-heading"
                >
                  <p className="eyebrow">LATEST APPLICATION</p>
                  <h2 id="application-status-heading">
                    {statusLabels[latest.status]}
                  </h2>
                  <p>
                    Submitted{" "}
                    <time dateTime={latest.submitted_at}>
                      {formatDisplayDate(new Date(latest.submitted_at))}
                    </time>
                    . Status updated{" "}
                    <time dateTime={latest.status_updated_at}>
                      {formatDisplayDate(new Date(latest.status_updated_at))}
                    </time>
                    .
                  </p>
                  <p className="muted">
                    {latest.status === "submitted"
                      ? "Your application has been received. You can review your submitted answers below."
                      : latest.status === "under_review"
                        ? "Your application is under review."
                        : latest.status === "accepted"
                          ? "This application was accepted. Your current membership access is managed separately."
                          : latest.status === "rejected"
                            ? "This application was not accepted. Reapplication availability is shown separately below."
                            : "This application was withdrawn. Your submitted answers remain available below."}
                  </p>
                  <ApplicationAnswers application={latest} />
                  {latest.canWithdraw ? (
                    <div className="application-actions">
                      {confirmWithdrawal ? (
                        <div
                          className="notice"
                          role="group"
                          aria-label="Confirm withdrawal"
                        >
                          <p>
                            Withdraw this application? This closes the current
                            submission.
                          </p>
                          <ActionButton
                            variant="danger"
                            disabled={
                              !interactive || pending || loading || readFailed
                            }
                            onClick={() => void withdraw(confirmWithdrawal)}
                          >
                            {pending ? "Withdrawing..." : "Confirm withdrawal"}
                          </ActionButton>
                          <ActionButton
                            disabled={!interactive || pending}
                            onClick={() => setConfirmWithdrawal(null)}
                          >
                            Keep application
                          </ActionButton>
                        </div>
                      ) : (
                        <ActionButton
                          variant="danger"
                          disabled={
                            !interactive || loading || pending || readFailed
                          }
                          onClick={() => setConfirmWithdrawal(latest)}
                        >
                          Withdraw application
                        </ActionButton>
                      )}
                    </div>
                  ) : null}
                </section>
              ) : null}
              {entry.blockedBy === "restricted" ? (
                <p className="notice">
                  New applications are currently restricted for your account.
                  This is separate from any previous application decision.
                  Contact LOGOS leadership if you need clarification.
                </p>
              ) : entry.blockedBy === "identity" ? (
                <p className="notice">
                  Verified school account access is required to submit an
                  application.
                </p>
              ) : !entry.blockedBy ? (
                <section className="home-panel">
                  <h2>
                    {latest
                      ? "Apply again"
                      : "Applications are not configured yet"}
                  </h2>
                  {entry.academicYear ? (
                    <>
                      <p>
                        You may submit a new application. Your previous
                        application will remain on file.
                      </p>
                      <ActionButton
                        variant="primary"
                        disabled={
                          !interactive || loading || pending || readFailed
                        }
                        onClick={() => {
                          setNewApplication(true);
                          setNotice("");
                        }}
                      >
                        Start a new application
                      </ActionButton>
                    </>
                  ) : (
                    <p>
                      The current academic year has not been configured. A new
                      application cannot be submitted yet.
                    </p>
                  )}
                </section>
              ) : null}
              {entry.applications.length > 1 ? (
                <section>
                  <h2>Previous applications</h2>
                  {entry.applications.slice(1).map((application) => (
                    <ApplicationAnswers
                      key={application.id}
                      application={application}
                      earlier
                    />
                  ))}
                </section>
              ) : null}
            </>
          ) : (
            <div className="home-panel">
              <ApplicationForm
                key={entry.identityId}
                entry={entry}
                onSaved={(value) =>
                  updated(value, "Your application status is up to date.")
                }
                onChangedAccount={(value) =>
                  updated(
                    value,
                    "The signed-in account changed. The previous account's draft was cleared. Check the account shown before continuing.",
                  )
                }
                onCancel={
                  newApplication ? () => setNewApplication(false) : undefined
                }
              />
            </div>
          )}
          <div className="application-actions">
            <ActionLink href="/auth/sign-in" variant="quiet">
              Your account
            </ActionLink>
            <ActionLink href="/privacy" variant="quiet">
              Privacy
            </ActionLink>
          </div>
        </>
      )}
    </div>
  );
}

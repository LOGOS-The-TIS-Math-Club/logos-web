"use client";
import { ApplicationInput, ApplicationTextarea } from "./application-input.tsx";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ActionButton } from "./action.tsx";
import { ApplicationSelect } from "./application-select.tsx";
import { applicationInput } from "../src/applications/input.ts";
import {
  applicationRequest,
  ApplicationRequestError,
} from "../src/applications/request.ts";
import {
  interests,
  courses,
  contestOptions,
  presentOptions,
  attendanceOptions,
} from "../src/applications/presentation.ts";
import type { ApplicationEntry } from "../src/applications/presentation.ts";

type Payload = ReturnType<typeof applicationInput.parse>;
type Attempt = { requestId: string; payload: Payload };
const labels: Record<string, string> = {
  preferredName: "Enter your preferred name (up to 80 characters).",
  grade: "Choose your current grade.",
  academicInterests: "Choose at least one mathematical interest.",
  joinReason: "Write 30-500 characters about why you would like to join.",
  goals:
    "Write 30-500 characters about what you would like to learn or contribute.",
  experience: "Keep your experience answer within 500 characters.",
  mathCourse: "Choose a listed course or leave it blank.",
  contestInterest: "Choose your contest interest.",
  presentInterest: "Choose your presentation interest.",
  attendanceConfirmation: "Choose your regular meeting availability.",
  accuracyAcknowledged: "Confirm the accuracy statement.",
  gradeAcademicYear:
    "The academic year needs to be reviewed. Reload before submitting.",
};

export function ApplicationForm({
  entry,
  onSaved,
  onChangedAccount,
  onCancel,
}: {
  entry: ApplicationEntry;
  onSaved: (entry: ApplicationEntry) => void;
  onChangedAccount: (entry: ApplicationEntry) => void;
  onCancel?: () => void;
}) {
  const form = useRef<HTMLFormElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const attempt = useRef<Attempt | null>(null);
  const lock = useRef(false);
  const leaving = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [draftVersion, setDraftVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [retryAllowed, setRetryAllowed] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [existing, setExisting] = useState<ApplicationEntry | null>(null);
  const [authExpired, setAuthExpired] = useState(false);
  const [confirmation, setConfirmation] = useState<{
    message: string;
    action: () => void;
    title?: string;
    confirmLabel?: string;
  } | null>(null);
  const keepEditing = useRef<HTMLButtonElement>(null);
  const priorFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    setInteractive(true);
  }, []);

  function confirm(
    message: string,
    action: () => void,
    labels?: { title: string; confirmLabel: string },
  ) {
    priorFocus.current = document.activeElement as HTMLElement;
    setConfirmation({ message, action, ...labels });
  }
  function cancelConfirmation() {
    setConfirmation(null);
    priorFocus.current?.focus();
  }
  useEffect(() => {
    if (confirmation) keepEditing.current?.focus();
  }, [confirmation]);

  useEffect(() => {
    if (!dirty) return;
    const warn =
      "Your application draft is not saved. Leave and lose your answers?";
    const unload = (event: BeforeUnloadEvent) => {
      if (!leaving.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const link = (event: MouseEvent) => {
      const anchor = (event.target as Element)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (
        leaving.current ||
        !anchor ||
        event.ctrlKey ||
        event.metaKey ||
        anchor.target === "_blank" ||
        anchor.href === location.href ||
        (anchor.pathname === location.pathname &&
          anchor.search === location.search)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      confirm(warn, () => {
        leaving.current = true;
        window.location.assign(anchor.href);
      });
    };
    const traverse = (event: Event) => {
      if (
        (event as Event & { navigationType?: string }).navigationType ===
          "traverse" &&
        event.cancelable &&
        !leaving.current
      ) {
        const destination = (event as Event & { destination?: { url: string } })
          .destination?.url;
        if (destination) {
          event.preventDefault();
          confirm(warn, () => {
            leaving.current = true;
            window.location.assign(destination);
          });
        }
      }
    };
    const navigation = (window as unknown as { navigation?: EventTarget })
      .navigation;
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", link, true);
    navigation?.addEventListener("navigate", traverse);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", link, true);
      navigation?.removeEventListener("navigate", traverse);
    };
  }, [dirty]);

  function report(text: string) {
    setMessage(text);
    setTimeout(() => summary.current?.focus(), 0);
  }
  function finish(fresh: ApplicationEntry) {
    leaving.current = true;
    setDirty(false);
    onSaved(fresh);
  }

  async function reconcile() {
    const fresh = await applicationRequest<ApplicationEntry>(
      "/api/me/applications/entry",
    );
    if (fresh.identityId !== entry.identityId) {
      leaving.current = true;
      onChangedAccount(fresh);
      return true;
    }
    if (
      attempt.current &&
      fresh.applications.some((item) => item.id === attempt.current!.requestId)
    ) {
      finish(fresh);
      return true;
    }
    if (
      fresh.blockedBy ||
      !fresh.academicYear ||
      fresh.applications.some(
        (item) => !entry.applications.some((old) => old.id === item.id),
      )
    ) {
      setExisting(fresh);
      setRetryAllowed(false);
      report(
        "Your application access or records have changed. Your draft is still here. Review the current application status before continuing.",
      );
      return true;
    }
    setRetryAllowed(true);
    report(
      "No saved application was found for this submission. You can check again or retry the same submission. Your answers have been kept.",
    );
    return false;
  }

  async function check() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await reconcile();
    } catch {
      report(
        "Your submission status is still unknown. Your answers have been kept. Check again when the connection is available.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  async function save(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (lock.current || (uncertain && !retryAllowed)) return;
    if (!attempt.current) {
      const data = new FormData(form.current!);
      const parsed = applicationInput.safeParse({
        ...Object.fromEntries(data),
        grade: Number(data.get("grade")),
        gradeAcademicYear: entry.academicYear?.startYear,
        academicInterests: data.getAll("academicInterests"),
        accuracyAcknowledged: data.has("accuracyAcknowledged"),
        mathCourse: data.get("mathCourse") || null,
      });
      if (!parsed.success) {
        setErrors(
          Object.fromEntries(
            parsed.error.issues.map((issue) => {
              const field = String(issue.path[0]);
              return [field, labels[field] ?? "Check this answer."];
            }),
          ),
        );
        report("Please correct the highlighted answers.");
        return;
      }
      attempt.current = {
        requestId: crypto.randomUUID(),
        payload: parsed.data,
      };
    }
    lock.current = true;
    setBusy(true);
    setErrors({});
    setMessage("");
    setAuthExpired(false);
    let sent = false;
    let posted = false;
    try {
      const fresh = await applicationRequest<ApplicationEntry>(
        "/api/me/applications/entry",
      );
      if (fresh.identityId !== entry.identityId) {
        leaving.current = true;
        onChangedAccount(fresh);
        return;
      }
      const received = fresh.applications.find(
        (item) => item.id === attempt.current!.requestId,
      );
      if (received) {
        finish(fresh);
        return;
      }
      if (
        fresh.blockedBy ||
        fresh.academicYear?.startYear !==
          attempt.current.payload.gradeAcademicYear ||
        fresh.applications.some(
          (item) => !entry.applications.some((old) => old.id === item.id),
        )
      ) {
        setExisting(fresh);
        report(
          "Your application access or academic year has changed. Review the current status before submitting. Your draft has been kept.",
        );
        return;
      }
      sent = true;
      await applicationRequest("/api/me/applications", {
        ...attempt.current.payload,
        requestId: attempt.current.requestId,
      });
      posted = true;
      setUncertain(true);
      setRetryAllowed(false);
      await reconcile();
    } catch (error) {
      setAuthExpired(
        error instanceof ApplicationRequestError && error.status === 401,
      );
      if (
        error instanceof ApplicationRequestError &&
        error.status < 500 &&
        error.status !== 409 &&
        !posted &&
        !uncertain
      ) {
        setUncertain(false);
        attempt.current = null;
        setErrors(
          Object.fromEntries(
            error.fields.map(({ field }) => [
              field,
              labels[field] ?? "Check this answer.",
            ]),
          ),
        );
        report(
          error.status === 401
            ? "Your session expired. Your answers are still here. Sign in again in another tab, then retry."
            : error.status === 403
              ? "Your account cannot submit this application. Your answers have been kept. Check your account access."
              : "The application could not be saved. Check your answers and current application status. Your answers have been kept.",
        );
      } else if (sent || uncertain || posted) {
        setUncertain(true);
        setRetryAllowed(false);
        report(
          "The result could not be confirmed. Do not start another application. Check submission status below; your answers have been kept.",
        );
        try {
          await reconcile();
        } catch {
          /* Keep the uncertain state and original submission. */
        }
      } else {
        report(
          "The application could not be checked before saving. Nothing was sent. Your answers have been kept. Please retry.",
        );
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function feedback(name: string) {
    return errors[name] ? (
      <p id={`${name}-error`} className="field-error">
        {errors[name]}
      </p>
    ) : null;
  }
  function markDirty() {
    setDirty(true);
    setErrors({});
    setMessage("");
    setExisting(null);
    if (!uncertain) attempt.current = null;
  }
  function clearDraft() {
    if (lock.current || uncertain) return;
    attempt.current = null;
    leaving.current = false;
    setDirty(false);
    setErrors({});
    setExisting(null);
    setAuthExpired(false);
    setRetryAllowed(false);
    setMessage("All draft entries cleared.");
    // Remount the fields so native inputs and custom dropdowns reset together.
    setDraftVersion((version) => version + 1);
    setTimeout(
      () =>
        form.current
          ?.querySelector<HTMLInputElement>("#preferredName")
          ?.focus(),
      0,
    );
  }
  function attrs(name: string) {
    return {
      id: name,
      name,
      "aria-invalid": Boolean(errors[name]),
      "aria-describedby": `${name}-hint${errors[name] ? ` ${name}-error` : ""}`,
    };
  }
  function radio(
    name: string,
    title: string,
    options: readonly (readonly [string, string])[],
    hint: string,
  ) {
    return (
      <fieldset id={name} className="application-question">
        <legend>
          {title} <span className="small muted">(required)</span>
        </legend>
        <p id={`${name}-hint`} className="small muted">
          {hint}
        </p>
        <div className="application-options">
          {options.map(([value, label]) => (
            <label key={value}>
              <input
                type="radio"
                name={name}
                value={value}
                required
                aria-invalid={Boolean(errors[name])}
                aria-describedby={`${name}-hint${errors[name] ? ` ${name}-error` : ""}`}
              />
              {label}
            </label>
          ))}
        </div>
        {feedback(name)}
      </fieldset>
    );
  }

  return (
    <form
      ref={form}
      className="application-form"
      method="post"
      action="/api/me/applications"
      noValidate
      onSubmit={save}
      onChange={markDirty}
    >
      <noscript>JavaScript is required to submit an application.</noscript>
      <div className="notice small">
        Your draft stays on this page only. Refreshing or leaving loses unsaved
        answers.
      </div>
      {message ? (
        <div ref={summary} className="notice" role="alert" tabIndex={-1}>
          <p>{message}</p>
          {authExpired ? (
            <p>
              <a href="/auth/sign-in" target="_blank" rel="noopener">
                Sign in in another tab
              </a>
              , then return here to retry.
            </p>
          ) : null}
          {Object.keys(errors).length ? (
            <ul>
              {Object.entries(errors).map(([field, text]) => (
                <li key={field}>
                  <a href={`#${field}`}>{text}</a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <fieldset
        key={draftVersion}
        disabled={busy || uncertain}
        className="application-fields"
      >
        <section aria-labelledby="identity-section">
          <h2 id="identity-section">About you</h2>
          <p className="muted">
            School account:{" "}
            <strong className="application-email">{entry.email}</strong>
          </p>
          <div className="application-question">
            <label htmlFor="preferredName">Preferred name (required)</label>
            <p id="preferredName-hint" className="small muted">
              What name should club leaders and peers use for you?
            </p>
            <ApplicationInput
              {...attrs("preferredName")}
              type="text"
              autoComplete="given-name"
              maxLength={80}
              required
            />
            {feedback("preferredName")}
          </div>
          <div className="application-question">
            <label id="grade-label" htmlFor="grade">
              Grade level (required)
            </label>
            <p id="grade-hint" className="small muted">
              Your current grade for {entry.academicYear?.startYear}-
              {(entry.academicYear?.startYear ?? 0) + 1}.
            </p>
            <ApplicationSelect
              id="grade"
              name="grade"
              required
              options={[
                ["9", "Grade 9"],
                ["10", "Grade 10"],
                ["11", "Grade 11"],
                ["12", "Grade 12"],
              ]}
              placeholder="Choose your grade"
              disabled={!interactive || busy || uncertain}
              invalid={Boolean(errors.grade)}
              describedBy={attrs("grade")["aria-describedby"]}
              onValueChange={markDirty}
            />
            {feedback("grade")}
          </div>
        </section>
        <section aria-labelledby="interests-section">
          <h2 id="interests-section">Mathematics and your goals</h2>
          <fieldset className="application-question" id="academicInterests">
            <legend>Mathematical interests (required)</legend>
            <p id="academicInterests-hint" className="small muted">
              Which areas would you like to explore? Choose one or more.
            </p>
            <div className="application-options">
              {interests.map(([value, label]) => (
                <label key={value}>
                  <input
                    type="checkbox"
                    name="academicInterests"
                    value={value}
                    aria-invalid={Boolean(errors.academicInterests)}
                    aria-describedby={`academicInterests-hint${errors.academicInterests ? " academicInterests-error" : ""}`}
                  />
                  {label}
                </label>
              ))}
            </div>
            {feedback("academicInterests")}
          </fieldset>
          {[
            ["joinReason", "Why would you like to join LOGOS?", true],
            ["goals", "What would you like to learn or contribute?", true],
            ["experience", "Relevant background or experience", false],
          ].map(([name, title, required]) => (
            <div className="application-question" key={String(name)}>
              <label htmlFor={String(name)}>
                {String(title)} ({required ? "required" : "optional"})
              </label>
              <p id={`${name}-hint`} className="small muted">
                {required
                  ? "30-500 characters."
                  : "Up to 500 characters. Prior competition experience is not required."}
              </p>
              <ApplicationTextarea
                {...attrs(String(name))}
                rows={4}
                minLength={required ? 30 : undefined}
                maxLength={500}
                required={Boolean(required)}
              />
              {feedback(String(name))}
            </div>
          ))}
          <div className="application-question">
            <label id="mathCourse-label" htmlFor="mathCourse">
              Which maths course are you taking? (optional)
            </label>
            <p id="mathCourse-hint" className="small muted">
              You may leave this blank or choose not to share.
            </p>
            <ApplicationSelect
              id="mathCourse"
              name="mathCourse"
              options={[["", "Leave this blank"], ...courses]}
              placeholder="Choose a course, or skip"
              disabled={!interactive || busy || uncertain}
              invalid={Boolean(errors.mathCourse)}
              describedBy={attrs("mathCourse")["aria-describedby"]}
              onValueChange={markDirty}
            />
            {feedback("mathCourse")}
          </div>
        </section>
        <section aria-labelledby="participation-section">
          <h2 id="participation-section">Taking part</h2>
          {radio(
            "contestInterest",
            "Would you like to take part in in-club contests?",
            contestOptions,
            "Choose the option that fits you.",
          )}
          {radio(
            "presentInterest",
            "Would you be interested in presenting a topic?",
            presentOptions,
            "Members sometimes lead a session on something they find interesting.",
          )}
          {radio(
            "attendanceConfirmation",
            "Regular meeting availability",
            attendanceOptions,
            "Can you normally attend regular weekly meetings? Contact LOGOS leadership if you need the current schedule to answer.",
          )}
        </section>
        <div className="application-question">
          <label className="application-check">
            <input
              {...attrs("accuracyAcknowledged")}
              type="checkbox"
              required
            />
            <span>
              I confirm that the information provided is accurate and understand
              that LOGOS may use my verified TIS email for club-related
              communication.
            </span>
          </label>
          <span id="accuracyAcknowledged-hint" className="small muted">
            Required before submission.
          </span>
          {feedback("accuracyAcknowledged")}
        </div>
      </fieldset>
      <div className="application-actions">
        {uncertain ? (
          <>
            <ActionButton
              type="button"
              disabled={!interactive || busy}
              onClick={() => void check()}
            >
              Check submission status
            </ActionButton>
            {retryAllowed ? (
              <ActionButton
                variant="primary"
                type="button"
                disabled={!interactive || busy}
                onClick={() => void save()}
              >
                Retry same submission
              </ActionButton>
            ) : null}
          </>
        ) : (
          <ActionButton
            variant="primary"
            type="submit"
            disabled={!interactive || busy || Boolean(existing)}
          >
            {busy ? "Submitting..." : "Submit application"}
          </ActionButton>
        )}
        <ActionButton
          variant="danger"
          type="button"
          disabled={!interactive || !dirty || busy || uncertain}
          onClick={() =>
            confirm(
              "Clear all answers in this draft? Submitted applications will not be changed.",
              clearDraft,
              {
                title: "Clear all entries?",
                confirmLabel: "Clear all entries",
              },
            )
          }
        >
          Clear all entries
        </ActionButton>
        {existing ? (
          <ActionButton
            type="button"
            disabled={!interactive || busy}
            onClick={() =>
              confirm(
                "Leave this draft and view your current application status? Unsaved answers will be lost.",
                () => finish(existing),
              )
            }
          >
            View current status
          </ActionButton>
        ) : null}
        {onCancel ? (
          <ActionButton
            variant={dirty ? "danger" : "outline"}
            type="button"
            disabled={!interactive || busy}
            onClick={() => {
              const cancel = () => {
                leaving.current = true;
                onCancel();
              };
              if (dirty)
                confirm("Discard this unsaved application draft?", cancel);
              else cancel();
            }}
          >
            Cancel new application
          </ActionButton>
        ) : null}
      </div>
      {busy ? (
        <p role="status">
          Checking and saving your application. Please keep this page open.
        </p>
      ) : null}
      {confirmation ? (
        <div className="application-modal-backdrop">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="draft-confirm-heading"
            className="home-panel application-modal"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                cancelConfirmation();
              }
              if (event.key === "Tab") {
                const buttons =
                  event.currentTarget.querySelectorAll<HTMLButtonElement>(
                    "button",
                  );
                const first = buttons[0],
                  last = buttons[buttons.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <h2 id="draft-confirm-heading">
              {confirmation.title ?? "Leave this draft?"}
            </h2>
            <p>{confirmation.message}</p>
            <div className="application-actions">
              <ActionButton
                ref={keepEditing}
                type="button"
                onClick={cancelConfirmation}
              >
                Keep editing
              </ActionButton>
              <ActionButton
                variant="danger"
                type="button"
                onClick={() => {
                  setConfirmation(null);
                  confirmation.action();
                }}
              >
                {confirmation.confirmLabel ?? "Leave without saving"}
              </ActionButton>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}

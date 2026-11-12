"use client";
import {
  Children,
  isValidElement,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
  type FormHTMLAttributes,
} from "react";
import { ApplicationSelect } from "../application-select.tsx";
import {
  ApplicationInput,
  ApplicationTextarea,
} from "../application-input.tsx";
import Link from "next/link";
import { BackLink } from "../back-link.tsx";
import { DashboardIcon } from "../dashboard/icon.tsx";
import { ActionButton } from "../action.tsx";
import { AdminRequestError, adminRequest } from "../../src/admin/request.ts";
import { dateInputValue } from "../../src/admin/presentation.ts";
import { formatDisplayDate } from "../../src/presentation/date.ts";
export function useRead<T>(url: string) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [version, refresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setData(undefined);
    setError("");
    setLoading(true);
    adminRequest<T>(url, "GET", undefined, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [url, version]);
  return { data, error, loading, refresh: () => refresh((v) => v + 1) };
}
export function ReadState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  return loading ? (
    <p className="admin-loading" role="status">
      Loading records...
    </p>
  ) : error ? (
    <div className="admin-feedback is-error" role="alert">
      <p>{error}</p>
      <ActionButton onClick={retry}>Try again</ActionButton>
    </div>
  ) : null;
}
export function Field({
  name,
  label,
  type = "text",
  value = "",
  required = false,
  maxLength,
  options,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  maxLength?: number;
  options?: [string, string][];
  hint?: string;
}) {
  const feedback = useContext(FeedbackContext);
  const controls = useContext(ControlContext);
  const [selection, setSelection] = useState(String(value));
  const error = feedback?.fields
    ?.filter((f) => f.field.split(".").at(-1) === name)
    .map((f) => f.message)
    .join(" ");
  const description =
    [hint ? `${name}-hint` : "", error ? `${name}-error` : ""]
      .filter(Boolean)
      .join(" ") || undefined;
  const accessibility = {
    "aria-invalid": error ? (true as const) : undefined,
    "aria-describedby": description,
  };
  return (
    <div
      className={`application-question admin-field ${type === "textarea" ? "is-wide" : ""}`}
    >
      <label id={`${name}-label`} htmlFor={name}>
        {label}
        <span className="admin-field-requirement">
          {required ? "Required" : options ? "" : "Optional"}
        </span>
      </label>
      {hint ? (
        <p id={`${name}-hint`} className="admin-hint">
          {hint}
        </p>
      ) : null}
      {options ? (
        <ApplicationSelect
          id={name}
          name={name}
          options={options}
          placeholder={options[0]?.[1] ?? "Choose an option"}
          value={selection || options[0]?.[0] || ""}
          required={required}
          disabled={controls.disabled}
          invalid={!!error}
          describedBy={description ?? ""}
          onValueChange={(next) => {
            setSelection(next);
            controls.changed();
          }}
        />
      ) : type === "textarea" ? (
        <ApplicationTextarea
          {...accessibility}
          id={name}
          name={name}
          defaultValue={value}
          required={required}
          maxLength={maxLength}
          rows={4}
        />
      ) : (
        <ApplicationInput
          {...accessibility}
          id={name}
          name={name}
          type={type}
          defaultValue={
            type === "date" && typeof value === "string"
              ? dateInputValue(value)
              : value
          }
          required={required}
          maxLength={maxLength}
        />
      )}
      {error ? (
        <p className="field-error" id={`${name}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
export type Feedback = {
  text: string;
  error: boolean;
  fields?: { field: string; message: string }[];
};
const ControlContext = createContext({ disabled: false, changed: () => {} });
const FeedbackContext = createContext<Feedback | null>(null);
export function useFeedback(): [Feedback, (value: string | Error) => void] {
  const [feedback, setFeedback] = useState<Feedback>({
    text: "",
    error: false,
  });
  return [
    feedback,
    (value) =>
      setFeedback(
        typeof value === "string"
          ? { text: value, error: false }
          : {
              text: value.message,
              error: true,
              fields:
                value instanceof AdminRequestError ? value.fields : undefined,
            },
      ),
  ];
}
export function AdminForm({
  feedback,
  children,
  formRef,
  onDirty,
  ...props
}: FormHTMLAttributes<HTMLFormElement> & {
  feedback: Feedback;
  formRef?: RefObject<HTMLFormElement | null>;
  onDirty?: () => void;
}) {
  const internal = useRef<HTMLFormElement>(null);
  const form = formRef ?? internal;
  const fieldset = Children.toArray(children).find(
    (child) => isValidElement(child) && child.type === "fieldset",
  );
  const disabled =
    isValidElement<{ disabled?: boolean }>(fieldset) &&
    !!fieldset.props.disabled;
  useEffect(() => {
    if (feedback.error && feedback.fields?.length)
      form.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"]')
        ?.focus();
  }, [feedback]);
  return (
    <FeedbackContext.Provider value={feedback}>
      <ControlContext.Provider
        value={{ disabled, changed: onDirty ?? (() => {}) }}
      >
        <form {...props} ref={form} onChange={onDirty}>
          {children}
        </form>
      </ControlContext.Provider>
    </FeedbackContext.Provider>
  );
}
export function Message({ children }: { children: Feedback }) {
  return children.text ? (
    <div
      className={`admin-feedback ${children.error ? "is-error" : "is-success"}`}
      role={children.error ? "alert" : "status"}
    >
      <strong>{children.error ? "Could not save" : "Saved"}</strong>
      <p>{children.text}</p>
    </div>
  ) : null;
}
export function Status({ value }: { value: unknown }) {
  const key = String(value);
  const labels: Record<string, string> = {
    under_review: "Under review",
    unexcused_absence: "Absent",
    excused_absence: "Excused",
    unmarked: "Not marked",
    submitted: "Submitted",
    acknowledged: "Acknowledged",
    withdrawn: "Withdrawn",
    accepted: "Accepted",
    rejected: "Rejected",
    active: "Active",
    paused: "Paused",
    former: "Former",
    scheduled: "Scheduled",
    cancelled: "Cancelled",
    published: "Published",
    draft: "Draft",
  };
  return (
    <span className={`admin-status status-${key}`}>
      {labels[key] ??
        key.charAt(0).toUpperCase() + key.slice(1).replaceAll("_", " ")}
    </span>
  );
}
export function RecordLink({
  href,
  title,
  meta,
  status,
}: {
  href: string;
  title: ReactNode;
  meta?: ReactNode;
  status?: unknown;
}) {
  return (
    <Link className="admin-record-link" href={href}>
      <span className="admin-record-copy">
        <strong>{title}</strong>
        {meta ? <span className="admin-record-meta">{meta}</span> : null}
      </span>
      {status !== undefined ? <Status value={status} /> : null}
      <DashboardIcon name="right" className="admin-record-arrow" />
    </Link>
  );
}
export function Filter({
  label,
  id,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
  disabled?: boolean;
}) {
  const controls = useContext(ControlContext);
  return (
    <div className="admin-filter">
      <label id={`${id}-label`} htmlFor={id}>
        {label}
      </label>
      <ApplicationSelect
        id={id}
        name={id}
        value={value}
        options={options}
        placeholder={
          options.find(([key]) => key === value)?.[1] ?? "Choose an option"
        }
        disabled={disabled || controls.disabled}
        describedBy=""
        onValueChange={(next) => {
          onChange(next);
          controls.changed();
        }}
      />
    </div>
  );
}
export function Search({
  value,
  onChange,
  label = "Search this list",
}: {
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  return (
    <div className="admin-filter admin-search">
      <label htmlFor="admin-search">{label}</label>
      <ApplicationInput
        type="search"
        id="admin-search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Name or title"
      />
    </div>
  );
}
export function Panel({
  title,
  children,
  description,
}: {
  title: string;
  children: ReactNode;
  description?: string;
}) {
  return (
    <section className="home-panel admin-panel">
      <div className="admin-panel-heading">
        <h2>{title}</h2>
        {description ? <p>{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
export function day(value: unknown) {
  return value
    ? formatDisplayDate(
        new Date(String(value)),
        /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? "UTC" : "Asia/Tokyo",
      )
    : "Not recorded";
}
export function isoToday() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
export function formValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form));
}
export const gradeOptions: [string, string][] = [9, 10, 11, 12].map((n) => [
  String(n),
  `Grade ${n}`,
]);
export function AdminBack({
  href = "/admin",
  children = "All leadership tools",
}: {
  href?: string;
  children?: ReactNode;
}) {
  return <BackLink href={href}>{children}</BackLink>;
}

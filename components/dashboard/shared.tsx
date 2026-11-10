"use client";
import { useSearchParams } from "next/navigation.js";
import { ActionLink, ActionButton } from "../action.tsx";
import type { ProtectedState, Session } from "../../src/dashboard/types.ts";
import { formatDisplayDate } from "../../src/presentation/date.ts";
import { sessionTime } from "../../src/dashboard/presentation.ts";
import { DashboardIcon } from "./icon.tsx";
export function AccessMessage({
  status,
  intended,
}: {
  status: Exclude<ProtectedState<unknown>["status"], "ready">;
  intended: string;
}) {
  const query = useSearchParams().toString();
  const destination = query ? `${intended}?${query}` : intended;
  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <p className="eyebrow">LOGOS / MEMBERS</p>
        <h1>Member dashboard</h1>
      </div>
      <section className="home-panel">
        <h2>
          {status === "anonymous"
            ? "Sign in to continue"
            : status === "denied"
              ? "Member access required"
              : status === "unconfigured"
                ? "School sign-in is unavailable"
                : status === "missing"
                  ? "Session not found"
                  : "Member services are temporarily unavailable"}
        </h2>
        <p>
          {status === "anonymous"
            ? "Use your verified @tokyois.com Google account to access member services."
            : status === "denied"
              ? "This account does not currently have access to member services. You can check your application or account."
              : status === "unconfigured"
                ? "Sign-in is not configured for this environment yet."
                : status === "missing"
                  ? "This session could not be found or is no longer available."
                  : "Your account or member data could not be checked. Please try again."}
        </p>
        <div className="dashboard-actions">
          {status === "unavailable" ? (
            <ActionButton onClick={() => location.reload()}>Retry</ActionButton>
          ) : null}
          <ActionLink
            href={`/auth/sign-in?${new URLSearchParams({ returnTo: destination })}`}
          >
            {status === "anonymous" ? "Sign in" : "Your account"}
          </ActionLink>
          {status === "denied" ? (
            <ActionLink href="/apply">View application</ActionLink>
          ) : null}
          <ActionLink href="/" variant="quiet">
            Return home
          </ActionLink>
        </div>
      </section>
    </div>
  );
}
export function SessionFacts({ session }: { session: Session }) {
  return (
    <p className="dashboard-session-facts">
      <time dateTime={session.startsAt}>
        <DashboardIcon name="calendar" />
        {formatDisplayDate(new Date(session.startsAt))}
      </time>
      <span>
        <DashboardIcon name="clock" />
        {sessionTime(session)}
      </span>
      <span>{session.durationMinutes} minutes</span>
      {session.location ? <span>{session.location}</span> : null}
      <span
        className={`dashboard-badge ${session.status === "cancelled" ? "is-cancelled" : ""}`}
      >
        {session.status === "cancelled" ? "Cancelled" : "Scheduled"}
      </span>
    </p>
  );
}
export function Materials({
  session,
  compact = false,
}: {
  session: Session;
  compact?: boolean;
}) {
  return session.materialsUnavailable ? (
    <p className="muted" role="status">
      The materials link is unavailable.
    </p>
  ) : session.materialsFolderUrl ? (
    <div className={`dashboard-materials ${compact ? "is-compact" : ""}`}>
      <ActionLink
        href={session.materialsFolderUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        <DashboardIcon name="folder" />
        Open materials folder
      </ActionLink>
      {!compact ? (
        <p className="small muted">
          Google Drive controls folder access. LOGOS membership alone does not
          grant access.
        </p>
      ) : null}
    </div>
  ) : (
    <p className="muted">Materials not added yet</p>
  );
}

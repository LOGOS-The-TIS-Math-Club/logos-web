"use client";
import { useEffect, useRef, useState } from "react";
import { ActionLink } from "../action.tsx";
import { AccessMessage, SessionFacts, Materials } from "./shared.tsx";
import type { ProtectedState, Session } from "../../src/dashboard/types.ts";
import {
  dashboardRequest,
  DashboardRequestError,
} from "../../src/dashboard/request.ts";
import { DashboardIcon } from "./icon.tsx";
import { sessionInfo } from "../../src/dashboard/session.ts";
import { internalDestination } from "../../src/auth/navigation.ts";
type Data = {
  identityId: string;
  session: Session;
  canReportAbsence: boolean | null;
};
export function SessionPage({
  initial,
  sessionId,
}: {
  initial: ProtectedState<Data>;
  sessionId: string;
}) {
  const [state, setState] = useState(initial),
    [loading, setLoading] = useState(false),
    [failed, setFailed] = useState(false),
    [back, setBack] = useState("/dashboard");
  const read = useRef<AbortController | null>(null);
  async function reload() {
    read.current?.abort();
    const current = new AbortController();
    read.current = current;
    setLoading(true);
    try {
      const row = await dashboardRequest<Record<string, any>>(
        `/api/sessions/${sessionId}`,
        undefined,
        current.signal,
      );
      if (row.id !== sessionId) throw new Error("Session response mismatch");
      if (!current.signal.aborted) {
        setState((previous) =>
          previous.status === "ready"
            ? {
                status: "ready",
                data: { ...previous.data, session: sessionInfo(row) },
              }
            : previous,
        );
        setFailed(false);
      }
    } catch (error) {
      if (!current.signal.aborted) {
        if (
          error instanceof DashboardRequestError &&
          (error.status === 401 || error.status === 403 || error.status === 404)
        )
          setState({
            status:
              error.status === 401
                ? "anonymous"
                : error.status === 404
                  ? "missing"
                  : "denied",
          });
        else setFailed(true);
      }
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    const from = internalDestination(
      new URLSearchParams(location.search).get("from"),
    );
    if (from && new URL(from, location.origin).pathname === "/dashboard")
      setBack(from);
    if (initial.status !== "ready") return;
    const restore = () => {
      void reload();
    };
    restore();
    window.addEventListener("focus", restore);
    window.addEventListener("pageshow", restore);
    return () => {
      read.current?.abort();
      window.removeEventListener("focus", restore);
      window.removeEventListener("pageshow", restore);
    };
  }, [sessionId]);
  if (state.status !== "ready")
    return (
      <AccessMessage
        status={state.status}
        intended={`/dashboard/sessions/${sessionId}`}
      />
    );
  const { session, canReportAbsence } = state.data;
  return (
    <div className="dashboard-page dashboard-detail">
      <div className="dashboard-actions">
        <ActionLink href={back} variant="quiet">
          <DashboardIcon name="left" />
          Sessions
        </ActionLink>
        <ActionLink href="/auth/sign-in" variant="quiet">
          Your account
        </ActionLink>
      </div>
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">LOGOS / SESSION</p>
          <h1>{session.title}</h1>
          <SessionFacts session={session} />
        </div>
        <button
          type="button"
          className="dashboard-icon-button"
          aria-label="Refresh session"
          title="Refresh session"
          disabled={loading}
          onClick={() => void reload()}
        >
          <DashboardIcon
            name="refresh"
            className={loading ? "is-refreshing" : ""}
          />
        </button>
      </div>
      {failed ? (
        <p role="alert" className="notice">
          The session could not be refreshed. Details below were last loaded
          earlier.
        </p>
      ) : null}
      {session.status === "cancelled" ? (
        <p className="notice">
          This session is cancelled. Historical attendance is preserved, and
          this session does not count toward attendance percentages.
        </p>
      ) : null}
      {session.description ? (
        <section className="home-panel">
          <h2>About this session</h2>
          <p className="dashboard-prose">{session.description}</p>
        </section>
      ) : null}
      <section className="home-panel">
        <h2>Materials</h2>
        <Materials session={session} />
      </section>
      {canReportAbsence && session.status !== "cancelled" ? (
        <ActionLink
          href={`/dashboard?${new URLSearchParams({ absenceSession: session.id })}#absence`}
          variant="primary"
        >
          Report an absence for this session
        </ActionLink>
      ) : null}
    </div>
  );
}

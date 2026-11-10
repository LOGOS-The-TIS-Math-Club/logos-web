"use client";
import { useEffect, useRef, useState } from "react";
import { ActionButton, ActionLink } from "../action.tsx";
import { AccessMessage } from "./shared.tsx";
import { Records } from "./records.tsx";
import { DashboardIcon } from "./icon.tsx";
import type {
  Notice,
  PersonalData,
  ProtectedState,
} from "../../src/dashboard/types.ts";
import {
  dashboardRequest,
  DashboardRequestError,
} from "../../src/dashboard/request.ts";
export function AttendancePage({
  initial,
}: {
  initial: ProtectedState<PersonalData>;
}) {
  const [state, setState] = useState(initial),
    [loading, setLoading] = useState(false),
    [failed, setFailed] = useState(false),
    [pending, setPending] = useState(false),
    [interactive, setInteractive] = useState(false);
  const [confirmation, setConfirmation] = useState<Notice | null>(null),
    [message, setMessage] = useState("");
  const reads = useRef<AbortController | null>(null),
    mutation = useRef(false);
  async function reload() {
    if (mutation.current) return;
    reads.current?.abort();
    const current = new AbortController();
    reads.current = current;
    setLoading(true);
    try {
      const data = await dashboardRequest<PersonalData>(
        "/api/dashboard/records",
        undefined,
        current.signal,
      );
      if (!current.signal.aborted) {
        setState({ status: "ready", data });
        setFailed(false);
        setConfirmation((previous) =>
          previous &&
          data.notices.status === "available" &&
          data.notices.data?.some(
            (n) =>
              n.id === previous.id &&
              n.revision === previous.revision &&
              n.status !== "cancelled",
          )
            ? previous
            : null,
        );
      }
    } catch (error) {
      if (!current.signal.aborted) {
        if (
          error instanceof DashboardRequestError &&
          (error.status === 401 || error.status === 403)
        )
          setState({ status: error.status === 401 ? "anonymous" : "denied" });
        else setFailed(true);
      }
    } finally {
      if (!current.signal.aborted) setLoading(false);
    }
  }
  useEffect(() => {
    setInteractive(true);
    if (initial.status === "unconfigured") return;
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
  }, []);
  async function cancel(notice: Notice) {
    if (mutation.current) return;
    mutation.current = true;
    reads.current?.abort();
    setPending(true);
    setLoading(false);
    setMessage("");
    try {
      const result = await dashboardRequest<{
        revision: number;
        status: "cancelled";
      }>(`/api/me/absences/${notice.id}/cancel`, { revision: notice.revision });
      setState((previous) =>
        previous.status === "ready" &&
        previous.data.notices.status === "available" &&
        previous.data.notices.data
          ? {
              status: "ready",
              data: {
                ...previous.data,
                notices: {
                  status: "available",
                  data: previous.data.notices.data.map((n) =>
                    n.id === notice.id ? { ...n, ...result } : n,
                  ),
                },
              },
            }
          : previous,
      );
      setMessage(
        "Your absence report was withdrawn. Recorded attendance has not changed.",
      );
    } catch (error) {
      setMessage(
        error instanceof DashboardRequestError && error.status === 409
          ? "This report changed before withdrawal. Review the refreshed status before trying again."
          : "Withdrawal could not be confirmed. Check the refreshed status before trying again.",
      );
    } finally {
      mutation.current = false;
      setPending(false);
      setConfirmation(null);
      await reload();
    }
  }
  if (state.status !== "ready")
    return (
      <AccessMessage status={state.status} intended="/dashboard/attendance" />
    );
  return (
    <div className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">LOGOS / MY RECORDS</p>
          <h1>My records</h1>
          <p className="muted">
            Your attendance history and absence reports, in one place.
          </p>
        </div>
        <div className="dashboard-actions dashboard-header-actions">
          <ActionLink href="/dashboard" variant="quiet">
            <DashboardIcon name="left" />
            Dashboard
          </ActionLink>
          {state.data.member.status === "available" &&
          state.data.member.data ? (
            <ActionLink href="/dashboard#absence" variant="primary">
              <DashboardIcon name="report" />
              Report an absence
            </ActionLink>
          ) : null}
          <button
            type="button"
            className="dashboard-icon-button"
            aria-label="Refresh my records"
            title="Refresh my records"
            disabled={!interactive || loading || pending}
            onClick={() => void reload()}
          >
            <DashboardIcon
              name="refresh"
              className={loading ? "is-refreshing" : ""}
            />
          </button>
        </div>
      </div>
      {message ? (
        <p role="status" className="notice">
          {message}
        </p>
      ) : null}
      {failed ? (
        <p className="notice" role="alert">
          Your records could not be refreshed. Information below was last loaded
          earlier. Please retry.
        </p>
      ) : null}
      <Records
        data={state.data}
        noticeAction={(notice) =>
          notice.status === "cancelled" ? null : confirmation?.id ===
            notice.id ? (
            <div
              className="notice"
              role="group"
              aria-label="Confirm report withdrawal"
            >
              <p>
                Withdraw this absence report? This does not change your recorded
                attendance.
              </p>
              <div className="dashboard-actions">
                <ActionButton
                  variant="danger"
                  className="dashboard-small-action"
                  disabled={!interactive || loading || pending || failed}
                  onClick={() => void cancel(confirmation)}
                >
                  {pending ? "Withdrawing..." : "Withdraw report"}
                </ActionButton>
                <ActionButton
                  className="dashboard-small-action"
                  disabled={pending}
                  onClick={() => setConfirmation(null)}
                >
                  Keep report
                </ActionButton>
              </div>
            </div>
          ) : (
            <ActionButton
              variant="danger"
              className="dashboard-small-action"
              aria-describedby={`notice-context-${notice.id}`}
              disabled={!interactive || loading || pending || failed}
              onClick={() => setConfirmation(notice)}
            >
              <DashboardIcon name="close" />
              Withdraw report
            </ActionButton>
          )
        }
      />
    </div>
  );
}

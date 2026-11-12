"use client";
import { useEffect, useRef, useState } from "react";
import { ActionButton, ActionLink } from "../action.tsx";
import { DashboardIcon } from "./icon.tsx";
import { ContentImage } from "../content-image.tsx";
import { PostImageGallery } from "../post-image-gallery.tsx";
import { AccessMessage, SessionFacts, Materials } from "./shared.tsx";
import { SessionBrowser } from "./session-browser.tsx";
import { Records } from "./records.tsx";
import { AbsenceForm } from "./absence-form.tsx";
import { AbsenceDrawer } from "./absence-drawer.tsx";
import { DraftGuard } from "./draft-guard.tsx";
import type {
  DashboardData,
  PersonalData,
  ProtectedState,
  Session,
} from "../../src/dashboard/types.ts";
import {
  dashboardRequest,
  DashboardRequestError,
} from "../../src/dashboard/request.ts";
import { formatDisplayDate } from "../../src/presentation/date.ts";
export function Dashboard({
  initial,
}: {
  initial: ProtectedState<DashboardData>;
}) {
  const [state, setState] = useState(initial),
    [loading, setLoading] = useState(false),
    [failed, setFailed] = useState(false),
    [draft, setDraft] = useState(false);
  const reads = useRef<AbortController | null>(null);
  const [absenceOpen, setAbsenceOpen] = useState(false);
  useEffect(() => {
    const restore = () =>
      setAbsenceOpen(
        location.hash === "#absence" ||
          new URLSearchParams(location.search).has("absenceSession"),
      );
    restore();
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, []);
  function openAbsence() {
    history.replaceState(
      null,
      "",
      `${location.pathname}${location.search}#absence`,
    );
    setAbsenceOpen(true);
  }
  function closeAbsence() {
    const params = new URLSearchParams(location.search);
    params.delete("absenceSession");
    history.replaceState(
      null,
      "",
      `${location.pathname}${params.size ? `?${params}` : ""}`,
    );
    setAbsenceOpen(false);
  }
  async function reload() {
    if (draft) return;
    reads.current?.abort();
    const current = new AbortController();
    reads.current = current;
    setLoading(true);
    try {
      const data = await dashboardRequest<DashboardData>(
        "/api/dashboard",
        undefined,
        current.signal,
      );
      if (!current.signal.aborted) {
        setState({ status: "ready", data });
        setFailed(false);
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
    if (draft || initial.status === "unconfigured") return;
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
  }, [draft, initial.status]);
  if (state.status !== "ready")
    return <AccessMessage status={state.status} intended="/dashboard" />;
  const data = state.data,
    next =
      data.nextSession.status === "available" ? data.nextSession.data : null;
  const member =
    data.personal.member.status === "available"
      ? data.personal.member.data
      : null;
  const noticeSessions: Session[] =
    data.calendar.status === "available" && data.calendar.data
      ? data.calendar.data.sessions
      : [];
  const personalUpdated = (personal: PersonalData) =>
    setState((previous) =>
      previous.status === "ready" &&
      previous.data.identityId === personal.identityId
        ? { status: "ready", data: { ...previous.data, personal } }
        : previous,
    );
  return (
    <div className="dashboard-page" id="member-dashboard">
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">LOGOS / MEMBERS</p>
          <h1>Dashboard</h1>
          <p className="dashboard-welcome">
            {member
              ? `Welcome back, ${member.displayName}.`
              : "Your club sessions and materials."}
            {member?.status === "paused" ? (
              <span className="dashboard-badge">Membership paused</span>
            ) : null}
          </p>
        </div>
        <div className="dashboard-actions dashboard-header-actions">
          {member ? (
            <ActionButton onClick={openAbsence} variant="primary">
              <DashboardIcon name="report" />
              {draft ? "Continue absence draft" : "Report an absence"}
            </ActionButton>
          ) : null}
          <ActionLink
            href="/auth/sign-in"
            variant="quiet"
            className="dashboard-account-link"
            aria-label="Your account"
          >
            <span className="dashboard-account-label">Your account</span>
            <DashboardIcon name="user" className="dashboard-account-icon" />
          </ActionLink>
          <button
            type="button"
            className="dashboard-icon-button"
            aria-label="Refresh dashboard"
            title={
              draft
                ? "Finish your absence draft before refreshing"
                : "Refresh dashboard"
            }
            disabled={loading || draft}
            onClick={() => void reload()}
          >
            <DashboardIcon
              name="refresh"
              className={loading ? "is-refreshing" : ""}
            />
          </button>
        </div>
      </div>
      {failed ? (
        <p className="notice" role="alert">
          The dashboard could not be refreshed. The information below was last
          loaded earlier.
        </p>
      ) : null}
      <div className="dashboard-workspace">
        <div className="dashboard-main">
          <section
            className="home-panel dashboard-next"
            aria-labelledby="next-session-heading"
          >
            <div className="dashboard-next-kicker">
              <span className="dashboard-section-icon">
                <DashboardIcon name="calendar" />
              </span>
              <p className="eyebrow">NEXT SESSION</p>
            </div>
            <h2 id="next-session-heading">{next?.title ?? "Next session"}</h2>
            {data.nextSession.status === "unavailable" ? (
              <p className="notice" role="status">
                The next session couldn't be loaded. Please refresh.
              </p>
            ) : next ? (
              <>
                <SessionFacts session={next} />
                {next.description ? (
                  <p className="dashboard-prose dashboard-next-description">
                    {next.description}
                  </p>
                ) : null}
                <div className="dashboard-next-actions">
                  <ActionLink
                    href={`/dashboard/sessions/${next.id}`}
                    variant="primary"
                  >
                    Open session <DashboardIcon name="arrow" />
                  </ActionLink>
                  <Materials session={next} compact />
                </div>
              </>
            ) : (
              <p className="dashboard-empty">
                No upcoming session is scheduled.
              </p>
            )}
          </section>
          <SessionBrowser
            data={data}
            onAccessLost={() => setState({ status: "denied" })}
          />
        </div>
        <aside
          className="dashboard-sidebar"
          aria-label="Your attendance and club updates"
        >
          <Records data={data.personal} compact />
          <section
            className="home-panel dashboard-news"
            aria-labelledby="dashboard-announcements"
          >
            <div className="dashboard-section-title">
              <span className="dashboard-section-icon">
                <DashboardIcon name="news" />
              </span>
              <h2 id="dashboard-announcements">Club updates</h2>
            </div>
            {data.announcements.status === "unavailable" ? (
              <p className="notice" role="status">
                Announcements couldn't be loaded. Please refresh.
              </p>
            ) : data.announcements.data.length ? (
              <ul className="dashboard-announcements">
                {data.announcements.data.map((item) => (
                  <li key={item.id}>
                    <time className="small muted" dateTime={item.publishedAt}>
                      {formatDisplayDate(new Date(item.publishedAt))}
                    </time>
                    <h3>{item.title}</h3>
                    <p className="dashboard-prose muted">{item.body}</p>
                    {item.imageId && item.imageWidth && item.imageHeight ? (
                      <ContentImage
                        id={item.imageId}
                        alt={item.imageAlt}
                        width={item.imageWidth}
                        height={item.imageHeight}
                        unavailableMessage="Announcement image unavailable."
                      />
                    ) : null}
                    <PostImageGallery images={item.additionalImages} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="dashboard-empty">No club updates yet.</p>
            )}
          </section>
        </aside>
      </div>
      {member ? (
        <AbsenceDrawer open={absenceOpen} onClose={closeAbsence}>
          <AbsenceForm
            key={data.identityId}
            identityId={data.identityId}
            sessions={[...noticeSessions, ...(next ? [next] : [])]}
            onDirty={setDraft}
            onRecords={personalUpdated}
            guardNavigation={false}
          />
        </AbsenceDrawer>
      ) : data.personal.member.status === "unavailable" ? (
        <p className="notice" role="status">
          Your member record couldn't be loaded. Please refresh before reporting
          an absence.
        </p>
      ) : null}
      <DraftGuard dirty={draft} />
    </div>
  );
}

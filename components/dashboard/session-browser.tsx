"use client";
import { Disclosure } from "../disclosure.tsx";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ActionButton } from "../action.tsx";
import { ApplicationSelect } from "../application-select.tsx";
import { SessionFacts } from "./shared.tsx";
import { MonthNavigation } from "./month-navigation.tsx";
import { DashboardIcon } from "./icon.tsx";
import type { DashboardData, Session } from "../../src/dashboard/types.ts";
import {
  dashboardRequest,
  DashboardRequestError,
} from "../../src/dashboard/request.ts";
import { sessionInfo } from "../../src/dashboard/session.ts";
import {
  displayDay,
  monthDays,
  shiftMonth,
  tokyoDay,
} from "../../src/dashboard/presentation.ts";

export function SessionBrowser({
  data,
  onAccessLost,
}: {
  data: DashboardData;
  onAccessLost: () => void;
}) {
  const calendar =
    data.calendar.status === "available" ? data.calendar.data : null;
  const hierarchy =
    data.hierarchy.status === "available" ? data.hierarchy.data : null;
  const [year, setYear] = useState(calendar?.academicYear.id ?? "");
  const [term, setTerm] = useState(calendar?.term?.id ?? "");
  const [view, setView] = useState<"list" | "calendar">("list");
  const [rows, setRows] = useState<Session[]>(
    calendar?.sessions.filter(
      (s) => !calendar.term || s.termId === calendar.term.id,
    ) ?? [],
  );
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(data.calendar.status === "unavailable");
  const [retry, setRetry] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const initial = useRef(true);
  const [restored, setRestored] = useState(false);
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    setNow(new Date().toISOString());
  }, []);
  const yearRecord = hierarchy?.academicYears.find((y) => y.id === year);
  const termRecord = hierarchy?.terms.find(
    (t) => t.id === term && t.academicYearId === year,
  );
  const earliest =
    termRecord?.startsOn.slice(0, 7) ??
    yearRecord?.startsOn.slice(0, 7) ??
    tokyoDay(new Date()).slice(0, 7);
  const latest = shiftMonth(
    (termRecord?.endsOn ?? yearRecord?.endsOn ?? `${earliest}-01`).slice(0, 7),
    (termRecord?.endsOn ?? yearRecord?.endsOn ?? "").endsWith("-01") ? -1 : 0,
  );
  const [month, setMonth] = useState(tokyoDay(new Date()).slice(0, 7));
  const currentMonth = tokyoDay(new Date()).slice(0, 7);
  const firstSessionMonth = rows[0]
    ? tokyoDay(rows[0].startsAt).slice(0, 7)
    : earliest;
  const fallbackMonth =
    currentMonth >= earliest && currentMonth <= latest
      ? currentMonth
      : firstSessionMonth >= earliest && firstSessionMonth <= latest
        ? firstSessionMonth
        : earliest;
  const monthToShow =
    month < earliest || month > latest ? fallbackMonth : month;
  const termOptions =
    hierarchy?.terms.filter((t) => t.academicYearId === year) ?? [];
  const from = `/dashboard?${new URLSearchParams({ year, term, view })}`;
  const href = (id: string) =>
    `/dashboard/sessions/${id}?${new URLSearchParams({ from })}`;

  useEffect(() => {
    if (!year && calendar) {
      setYear(calendar.academicYear.id);
      setTerm(calendar.term?.id ?? "");
    }
  }, [data.calendar]);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedYear = params.get("year"),
      requestedTerm = params.get("term");
    if (hierarchy?.academicYears.some((y) => y.id === requestedYear)) {
      setYear(requestedYear!);
      setTerm(
        hierarchy.terms.some(
          (t) => t.id === requestedTerm && t.academicYearId === requestedYear,
        )
          ? requestedTerm!
          : "",
      );
    }
    if (params.get("view") === "calendar") setView("calendar");
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored || !year) return;
    const params = new URLSearchParams(location.search);
    params.set("year", year);
    params.set("term", term);
    params.set("view", view);
    history.replaceState(
      null,
      "",
      `${location.pathname}?${params}${location.hash}`,
    );
  }, [year, term, view, restored]);
  useEffect(() => {
    if (!restored || !year) return;
    controller.current?.abort();
    if (
      initial.current &&
      retry === 0 &&
      year === calendar?.academicYear.id &&
      term === (calendar.term?.id ?? "")
    ) {
      initial.current = false;
      return;
    }
    initial.current = false;
    const current = new AbortController();
    controller.current = current;
    setLoading(true);
    setFailed(false);
    dashboardRequest<Record<string, any>[]>(
      `/api/sessions?${new URLSearchParams(term ? { termId: term } : { academicYearId: year })}`,
      undefined,
      current.signal,
    )
      .then((result) => {
        if (!current.signal.aborted) setRows(result.map(sessionInfo));
      })
      .catch((error) => {
        if (!current.signal.aborted) {
          setFailed(true);
          if (
            error instanceof DashboardRequestError &&
            (error.status === 401 || error.status === 403)
          )
            onAccessLost();
        }
      })
      .finally(() => {
        if (!current.signal.aborted) setLoading(false);
      });
    return () => current.abort();
  }, [year, term, retry, restored, data.calendar]);
  const upcomingRows = now
    ? rows.filter((session) => session.endsAt >= now)
    : rows;
  const earlierRows = now ? rows.filter((session) => session.endsAt < now) : [];
  const renderSession = (session: Session) => (
    <li key={session.id}>
      <div className="dashboard-date-tile" aria-hidden="true">
        <span>
          {new Intl.DateTimeFormat("en", {
            month: "short",
            timeZone: "Asia/Tokyo",
          }).format(new Date(session.startsAt))}
        </span>
        <strong>{tokyoDay(session.startsAt).slice(-2)}</strong>
      </div>
      <div className="dashboard-session-row-body">
        <Link href={href(session.id)} className="dashboard-session-title">
          {session.title}
        </Link>
        <SessionFacts session={session} />
        {session.description ? (
          <p className="muted dashboard-preview-prose">{session.description}</p>
        ) : null}
      </div>
      <span className="dashboard-row-open" aria-hidden="true">
        <DashboardIcon name="right" />
      </span>
    </li>
  );
  return (
    <section
      className="home-panel dashboard-sessions"
      aria-labelledby="sessions-heading"
    >
      <div className="dashboard-section-heading">
        <div className="dashboard-section-title">
          <span className="dashboard-section-icon">
            <DashboardIcon name="calendar" />
          </span>
          <div>
            <h2 id="sessions-heading">Sessions</h2>
            <p className="dashboard-section-description">
              Browse the programme and open a session for materials.
            </p>
          </div>
        </div>
        <div
          className="dashboard-view-switch"
          role="group"
          aria-label="Session view"
        >
          <ActionButton
            disabled={!restored}
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <DashboardIcon name="list" />
            List
          </ActionButton>
          <ActionButton
            disabled={!restored}
            aria-pressed={view === "calendar"}
            onClick={() => setView("calendar")}
          >
            <DashboardIcon name="calendar" />
            Calendar
          </ActionButton>
        </div>
      </div>
      {data.calendar.status === "available" && !calendar ? (
        <p className="notice">
          The current academic year is not configured. You can browse another
          configured year below.
        </p>
      ) : data.calendar.status === "available" && calendar && !calendar.term ? (
        <p className="notice">
          The current term is not configured. All sessions in this academic year
          are shown until you choose a term.
        </p>
      ) : null}
      {!hierarchy ? (
        <p className="notice">
          Academic years and terms are unavailable. Please refresh the
          dashboard.
        </p>
      ) : hierarchy.academicYears.length ? (
        <div className="dashboard-filters">
          <div>
            <label id="dashboard-year-label" htmlFor="dashboard-year">
              Academic year
            </label>
            <p id="dashboard-year-hint" className="sr-only">
              Choose an academic year to load its sessions.
            </p>
            <ApplicationSelect
              id="dashboard-year"
              name="academicYear"
              options={hierarchy.academicYears.map((y) => [y.id, y.name])}
              placeholder="Choose a year"
              describedBy="dashboard-year-hint"
              disabled={!restored}
              value={year}
              onValueChange={(value) => {
                controller.current?.abort();
                setLoading(true);
                setYear(value);
                setTerm("");
                setMonth("");
              }}
            />
          </div>
          <div>
            <label id="dashboard-term-label" htmlFor="dashboard-term">
              Term
            </label>
            <p id="dashboard-term-hint" className="sr-only">
              Terms belong to the selected academic year.
            </p>
            <ApplicationSelect
              id="dashboard-term"
              name="term"
              options={[
                ["", "All terms"],
                ...termOptions.map((t) => [t.id, t.name] as const),
              ]}
              placeholder="All terms"
              describedBy="dashboard-term-hint"
              value={term}
              disabled={!year || !restored}
              onValueChange={(value) => {
                controller.current?.abort();
                setLoading(true);
                setTerm(value);
                setMonth("");
              }}
            />
          </div>
        </div>
      ) : (
        <p className="muted">No academic years have been configured.</p>
      )}
      {loading ? (
        <p role="status">Loading sessions...</p>
      ) : failed ? (
        <div role="alert" className="notice">
          <p>Sessions could not be loaded. This is not an empty term.</p>
          <ActionButton onClick={() => setRetry((v) => v + 1)}>
            Retry sessions
          </ActionButton>
        </div>
      ) : !year ? (
        <p className="muted">
          Choose a configured academic year to browse sessions.
        </p>
      ) : rows.length === 0 ? (
        <p className="muted">
          {term
            ? "No sessions have been added to this term."
            : "No sessions have been added to this academic year."}
        </p>
      ) : view === "list" ? (
        <>
          {upcomingRows.length ? (
            <ul className="dashboard-session-list">
              {upcomingRows.map(renderSession)}
            </ul>
          ) : null}
          {earlierRows.length ? (
            <Disclosure
              className="dashboard-earlier-sessions"
              defaultOpen={!upcomingRows.length}
              summary={
                <>
                  Earlier sessions{" "}
                  <span className="dashboard-count">{earlierRows.length}</span>
                </>
              }
            >
              <ul className="dashboard-session-list">
                {earlierRows.map(renderSession)}
              </ul>
            </Disclosure>
          ) : null}
        </>
      ) : (
        <>
          <MonthNavigation
            month={monthToShow}
            previousDisabled={monthToShow <= earliest}
            nextDisabled={monthToShow >= latest}
            onPrevious={() => setMonth(shiftMonth(monthToShow, -1))}
            onNext={() => setMonth(shiftMonth(monthToShow, 1))}
          />
          <div className="dashboard-calendar" aria-label="Session calendar">
            <div className="dashboard-calendar-week" aria-hidden="true">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                <span key={day}>{day}</span>
              ))}
            </div>
            <div className="dashboard-calendar-days">
              {monthDays(monthToShow).map((day, index) => (
                <div key={day ?? index} className="dashboard-calendar-day">
                  {day ? (
                    <>
                      <time dateTime={day}>{Number(day.slice(-2))}</time>
                      {rows
                        .filter((session) => tokyoDay(session.startsAt) === day)
                        .map((session) => (
                          <Link
                            key={session.id}
                            href={href(session.id)}
                            className={
                              session.status === "cancelled"
                                ? "is-cancelled"
                                : ""
                            }
                            aria-label={`${displayDay(day)}, ${session.title}, ${session.status}`}
                          >
                            <span className="dashboard-calendar-label">
                              {session.title}
                            </span>
                            {session.status === "cancelled" ? (
                              <span className="dashboard-calendar-state">
                                Cancelled
                              </span>
                            ) : null}
                          </Link>
                        ))}
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <div className="dashboard-month-agenda">
            <h3>This month</h3>
            <ul>
              {rows
                .filter(
                  (session) =>
                    tokyoDay(session.startsAt).slice(0, 7) === monthToShow,
                )
                .map((session) => (
                  <li key={session.id}>
                    <time dateTime={session.startsAt}>
                      {displayDay(tokyoDay(session.startsAt))}
                    </time>
                    <Link href={href(session.id)}>{session.title}</Link>
                    {session.status === "cancelled" ? (
                      <span className="dashboard-badge is-cancelled">
                        Cancelled
                      </span>
                    ) : null}
                  </li>
                ))}
            </ul>
          </div>
          <p className="small muted">
            Select a session for details and materials. Use List for full
            session descriptions.
          </p>
        </>
      )}
    </section>
  );
}

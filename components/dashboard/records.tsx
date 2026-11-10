import { Disclosure } from "../disclosure.tsx";
import Link from "next/link";
import {
  attendanceLabels,
  attendanceText,
  noticeLabels,
  displayDay,
  tokyoDay,
} from "../../src/dashboard/presentation.ts";
import type { PersonalData, Notice } from "../../src/dashboard/types.ts";
import type { ReactNode } from "react";
import { DashboardIcon } from "./icon.tsx";

export function Records({
  data,
  compact = false,
  noticeAction,
}: {
  data: PersonalData;
  compact?: boolean;
  noticeAction?: (notice: Notice) => ReactNode;
}) {
  if (data.member.status === "available" && !data.member.data)
    return (
      <section className="home-panel dashboard-records">
        <h2>My attendance</h2>
        <p className="muted">
          This account has no member record, so personal attendance and absence
          reports aren't available.
        </p>
      </section>
    );
  const attendance =
    data.attendance.status === "available" ? data.attendance.data : null;
  const notices =
    data.notices.status === "available" ? data.notices.data : null;
  const records = attendance?.records ?? [];
  const visibleRecords = compact ? records.slice(0, 3) : records;
  const visibleNotices = compact ? notices?.slice(0, 3) : notices;
  const attendanceList = attendance ? (
    visibleRecords.length ? (
      <ul className="dashboard-record-list">
        {visibleRecords.map((record) => (
          <li key={record.sessionId}>
            <div>
              {record.session ? (
                <>
                  <time dateTime={record.session.startsAt}>
                    {displayDay(tokyoDay(record.session.startsAt))}
                  </time>
                  <Link
                    className="dashboard-record-title"
                    href={`/dashboard/sessions/${record.sessionId}`}
                  >
                    {record.session.title}
                  </Link>
                </>
              ) : (
                <Link
                  className="dashboard-record-title"
                  href={`/dashboard/sessions/${record.sessionId}`}
                >
                  Session details unavailable
                </Link>
              )}
            </div>
            <span className={`dashboard-badge status-${record.status}`}>
              {attendanceLabels[record.status]}
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="dashboard-empty">No eligible session records yet.</p>
    )
  ) : (
    <p role="status" className="notice">
      Attendance couldn't be loaded. Please refresh.
    </p>
  );
  const noticeList = notices ? (
    visibleNotices?.length ? (
      <ul
        className={compact ? "dashboard-record-list" : "dashboard-notice-list"}
      >
        {visibleNotices.map((notice) => {
          const date = notice.session
            ? tokyoDay(notice.session.startsAt)
            : notice.sessionDate;
          return (
            <li
              key={notice.id}
              className={compact ? undefined : "dashboard-notice-card"}
            >
              <div className="dashboard-notice-card-heading">
                <div id={`notice-context-${notice.id}`}>
                  {date ? (
                    <time dateTime={date}>{displayDay(date)}</time>
                  ) : null}
                  {notice.session ? (
                    <Link
                      className="dashboard-record-title"
                      href={`/dashboard/sessions/${notice.sessionId}`}
                    >
                      {notice.session.title}
                    </Link>
                  ) : (
                    <span className="dashboard-record-title">
                      Absence report
                    </span>
                  )}
                </div>
                <span className={`dashboard-badge status-${notice.status}`}>
                  {noticeLabels[notice.status]}
                </span>
              </div>
              {!compact ? (
                <>
                  <p className="dashboard-prose dashboard-notice-reason">
                    {notice.reason}
                  </p>
                  <div className="dashboard-notice-card-footer">
                    <span className="small muted">
                      Sent {displayDay(tokyoDay(notice.createdAt))}
                    </span>
                    {noticeAction?.(notice)}
                  </div>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    ) : (
      <p className="dashboard-empty">No absence reports yet.</p>
    )
  ) : (
    <p role="status" className="notice">
      Absence reports couldn't be loaded. Please refresh.
    </p>
  );
  return (
    <section
      id="my-attendance"
      className={`home-panel dashboard-records ${compact ? "is-compact" : ""}`}
      aria-labelledby="my-records-heading"
    >
      <div className="dashboard-section-title">
        <span className="dashboard-section-icon">
          <DashboardIcon name="report" />
        </span>
        <h2 id="my-records-heading">
          {compact ? "My attendance" : "Attendance summary"}
        </h2>
      </div>
      {attendance ? (
        <>
          <div className="dashboard-attendance-summary">
            <p className="dashboard-attendance-stat">
              {attendance.summary.percentage !== null ? (
                <>
                  {attendance.summary.percentage}
                  <span>%</span>
                </>
              ) : attendance.summary.eligibleSessions === 0 ? (
                "No records"
              ) : (
                "Pending"
              )}
            </p>
            <p className="dashboard-section-description">
              {attendance.summary.percentage === null
                ? attendanceText(attendance.summary)
                : "Across your eligible, marked sessions"}
            </p>
          </div>
          <dl className="dashboard-attendance-metrics">
            <div>
              <dt>Attended</dt>
              <dd>{attendance.summary.attended}</dd>
            </div>
            <div>
              <dt>Counted</dt>
              <dd>{attendance.summary.denominator}</dd>
            </div>
            <div>
              <dt>Unmarked</dt>
              <dd>{attendance.summary.pending}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p role="status" className="notice">
          Your attendance summary is unavailable.
        </p>
      )}
      {compact ? (
        <>
          <Disclosure
            className="dashboard-recent"
            summary={
              <>
                Recent activity
                <span className="muted small">Sessions &amp; reports</span>
              </>
            }
          >
            <h3>Recent sessions</h3>
            {attendanceList}
            <h3>Absence reports</h3>
            {noticeList}
          </Disclosure>
          <div className="dashboard-card-footer">
            <Link href="/dashboard/attendance" className="dashboard-text-link">
              View all my records <DashboardIcon name="arrow" />
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="dashboard-attendance-rule">
            <h3>How attendance is counted</h3>
            <p className="muted">
              Late counts as attended. Excused absences and unmarked sessions
              are excluded from the percentage.
            </p>
          </div>
          <div className="dashboard-history-heading">
            <h3>Session history</h3>
            <span className="dashboard-count">{records.length}</span>
          </div>
          {attendanceList}
          <div className="dashboard-history-heading">
            <h3>Absence reports</h3>
            <span className="dashboard-count">{notices?.length ?? 0}</span>
          </div>
          <p className="dashboard-section-description">
            Reports inform leadership. Recorded attendance is managed
            separately.
          </p>
          {noticeList}
        </>
      )}
    </section>
  );
}

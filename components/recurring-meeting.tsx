import { getDatabase } from "../src/server/database.ts";
import { getPublicRecurring, weekdays } from "../src/sessions/recurring.ts";
import { readPublic } from "../src/content/public-read.ts";
import { DashboardIcon } from "./dashboard/icon.tsx";

export async function RecurringMeeting({ cards = false }: { cards?: boolean }) {
  const result = await readPublic(() => getPublicRecurring(getDatabase()));
  const meeting = result.status === "available" ? result.data : null;

  if (cards && meeting) {
    return (
      <section aria-labelledby="recurring-meeting-heading">
        <div className="values-heading">
          <p className="eyebrow">Meet with LOGOS</p>
          <h2 id="recurring-meeting-heading">Regular meetings.</h2>
        </div>
        <ul className="values-grid meeting-details-grid">
          <li>
            <DashboardIcon name="calendar" />
            <h3>Day</h3>
            <p className="muted">{weekdays[meeting.weekday]}</p>
          </li>
          <li>
            <DashboardIcon name="clock" />
            <h3>Start time</h3>
            <p className="muted">{meeting.startTime} JST</p>
          </li>
          <li>
            <DashboardIcon name="timer" />
            <h3>Duration</h3>
            <p className="muted">{meeting.durationMinutes} minutes</p>
          </li>
          {meeting.room && (
            <li>
              <DashboardIcon name="location" />
              <h3>Location</h3>
              <p className="muted">{meeting.room}</p>
            </li>
          )}
        </ul>
        <p className="small muted">
          Members can check individual session dates and cancellations on their dashboard.
        </p>
      </section>
    );
  }

  return (
    <section
      className="home-section"
      aria-labelledby="recurring-meeting-heading"
    >
      <div>
        <p className="eyebrow">Meet with LOGOS</p>
        <h2 id="recurring-meeting-heading">Regular meetings.</h2>
      </div>
      <div className="home-rule">
        {result.status === "unavailable" ? (
          <p className="muted">
            Recurring meeting information is temporarily unavailable.
          </p>
        ) : result.data ? (
          <>
            <p>
              {weekdays[result.data.weekday]} · {result.data.startTime} JST ·{" "}
              {result.data.durationMinutes} minutes
              {result.data.room ? ` · ${result.data.room}` : ""}
            </p>
            <p className="small muted">
              This is the recurring schedule. Members can check individual
              session dates and cancellations on their dashboard.
            </p>
          </>
        ) : (
          <p className="muted">
            Recurring meeting details have not been published.
          </p>
        )}
      </div>
    </section>
  );
}

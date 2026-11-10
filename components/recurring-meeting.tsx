import { getDatabase } from "../src/server/database.ts";
import { getPublicRecurring, weekdays } from "../src/sessions/recurring.ts";
import { readPublic } from "../src/content/public-read.ts";
export async function RecurringMeeting() {
  const result = await readPublic(() => getPublicRecurring(getDatabase()));
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

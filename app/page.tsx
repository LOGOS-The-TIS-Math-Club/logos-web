import { Suspense } from "react";
import { HomeBanner } from "../components/home-banner.tsx";
import { AnnouncementImage } from "../components/announcement-image.tsx";
import { ActionLink } from "../components/action.tsx";
import {
  getClubInfo,
  getPublishedAnnouncements,
} from "../src/content/operations.ts";
import {
  readHomepage,
  formatPublicationDate,
} from "../src/content/homepage.ts";
import { getDatabase } from "../src/server/database.ts";
import { getPublicSessionSummary } from "../src/sessions/public.ts";

async function HomeUpdates({
  content,
}: {
  content: ReturnType<typeof readHomepage>;
}) {
  const { focus, announcements, sessions } = await content;
  return (
    <>
      <section className="home-section" aria-labelledby="week-heading">
        <div>
          <p className="eyebrow">Latest session</p>
          <h2 id="week-heading">What we did.</h2>
        </div>
        <div className="plated">
          <div className="home-panel">
            {sessions.status === "unavailable" ? (
              <p className="muted">
                The latest session is temporarily unavailable. Please try again
                later.
              </p>
            ) : sessions.data.latest ? (
              <>
                <h3>{sessions.data.latest.title}</h3>
                {sessions.data.latest.description && (
                  <p className="session-description muted">
                    {sessions.data.latest.description}
                  </p>
                )}
              </>
            ) : (
              <p className="muted">No completed sessions yet.</p>
            )}
          </div>
        </div>
      </section>
      <section className="home-section" aria-labelledby="plan-heading">
        <div>
          <p className="eyebrow">This term</p>
          <h2 id="plan-heading">Where we’re going.</h2>
        </div>
        <div className="home-rule">
          <p className="muted">
            {focus.status === "unavailable"
              ? "The term focus is temporarily unavailable. Please try again later."
              : (focus.data ?? "The term focus has not been added yet.")}
          </p>
          {sessions.status === "unavailable" ? (
            <p className="muted">
              Session titles are temporarily unavailable. Please try again
              later.
            </p>
          ) : sessions.data.termTitles === null ? (
            <p className="muted">
              The current term has not been configured yet.
            </p>
          ) : sessions.data.termTitles.length === 0 ? (
            <p className="muted">
              No sessions have been added for this term yet.
            </p>
          ) : (
            <ol className="programme-titles" aria-label="This term’s sessions">
              {sessions.data.termTitles.map((title, index) => (
                <li key={index}>{title}</li>
              ))}
            </ol>
          )}
          <p className="small muted">
            Session dates and details are available to members.
          </p>
          <ActionLink href="/members">Member hub</ActionLink>
        </div>
      </section>
      <section className="home-section" aria-labelledby="news-heading">
        <div>
          <p className="eyebrow">Notices</p>
          <h2 id="news-heading">Announcements.</h2>
        </div>
        {announcements.status === "unavailable" ? (
          <div className="home-rule">
            <p className="muted">
              Announcements are temporarily unavailable. Please try again later.
            </p>
            <a className="home-text-link" href="/">
              Reload announcements
            </a>
          </div>
        ) : announcements.data.length === 0 ? (
          <div className="home-rule">
            <p className="muted">No announcements right now.</p>
          </div>
        ) : (
          <ul className="announcement-list">
            {announcements.data.map((item) => (
              <li key={item.id} className="plated">
                <article className="home-panel announcement">
                  <time
                    className="datum muted"
                    dateTime={item.published_at.toISOString()}
                  >
                    {formatPublicationDate(item.published_at)}
                  </time>
                  <h3>{item.title}</h3>
                  <p className="announcement-body muted">{item.body}</p>
                  {item.image_id && item.image_width && item.image_height ? (
                    <AnnouncementImage
                      key={item.image_id}
                      id={item.image_id}
                      alt={item.image_alt ?? ""}
                      width={item.image_width}
                      height={item.image_height}
                    />
                  ) : null}
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export default function Home() {
  const content = readHomepage({
    announcements: () => getPublishedAnnouncements(getDatabase()),
    clubInfo: () => getClubInfo(getDatabase()),
    sessions: () => getPublicSessionSummary(getDatabase()),
  });
  return (
    <div className="homepage">
      <HomeBanner />
      <Suspense
        fallback={
          <div className="home-loading" role="status">
            Loading the term focus and announcements…
          </div>
        }
      >
        <HomeUpdates content={content} />
      </Suspense>
      <section className="home-closing plated" aria-labelledby="cta-heading">
        <div className="home-panel hatched">
          <div>
            <h2 id="cta-heading">Want to join?</h2>
            <p className="muted">
              Grades 9–12. No prior competition experience required.
            </p>
          </div>
          <ActionLink href="/apply" variant="primary">
            Apply to LOGOS
          </ActionLink>
        </div>
      </section>
    </div>
  );
}

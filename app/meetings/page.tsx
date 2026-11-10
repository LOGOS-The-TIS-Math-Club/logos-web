import { RecurringMeeting } from "../../components/recurring-meeting.tsx";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBanner } from "../../components/page-banner.tsx";
import { ActionLink } from "../../components/action.tsx";
import { RevealSection } from "../../components/reveal-section.tsx";
import { getClubInfo } from "../../src/content/operations.ts";
import { readPublic, type PublicRead } from "../../src/content/public-read.ts";
import {
  getPublicSessionSummary,
  type PublicSessionSummary,
} from "../../src/sessions/public.ts";
import { getDatabase } from "../../src/server/database.ts";

export const metadata: Metadata = {
  title: "Meetings",
  description:
    "How LOGOS sessions work and what the club is working on this term.",
};

async function TermFocus({
  content,
}: {
  content: Promise<PublicRead<Awaited<ReturnType<typeof getClubInfo>>>>;
}) {
  const result = await content;
  return (
    <p className="muted">
      {result.status === "unavailable"
        ? "The term focus is temporarily unavailable. Please try again later."
        : result.data?.semester_focus.trim() ||
          "The term focus has not been added yet."}
    </p>
  );
}

async function Programme({
  content,
}: {
  content: Promise<PublicRead<PublicSessionSummary>>;
}) {
  const result = await content;
  if (result.status === "unavailable")
    return (
      <div className="home-rule">
        <p className="muted">
          The programme is temporarily unavailable. Please try again later.
        </p>
        <a className="home-text-link" href="/meetings">
          Reload programme
        </a>
      </div>
    );
  const titles = result.data.termTitles;
  if (titles === null)
    return (
      <div className="home-rule muted">
        The current term has not been configured yet.
      </div>
    );
  if (titles.length === 0)
    return (
      <div className="home-rule muted">
        No sessions have been added for this term yet.
      </div>
    );
  return (
    <ol className="meeting-programme" aria-label="This term’s sessions">
      {titles.map((title, index) => (
        <li key={index}>
          <span className="datum muted" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span>{title}</span>
        </li>
      ))}
    </ol>
  );
}

export default function MeetingsPage() {
  const focus = readPublic(() => getClubInfo(getDatabase()));
  const programme = readPublic(() => getPublicSessionSummary(getDatabase()));
  return (
    <div className="meetings-page">
      <PageBanner
        className="meetings-banner"
        scene="orbit"
        theme="ascii-theme-sky"
        titleId="meetings-title"
        eyebrow="Meetings"
        title={
          <>
            The shape
            <br />
            of a session.
          </>
        }
        subtitle="Sessions build on each other, so coming regularly matters more than arriving with prior knowledge."
        actions={
          <>
            <ActionLink href="/apply" variant="primary">
              Apply to LOGOS
            </ActionLink>
            <ActionLink href="/join">Who can join</ActionLink>
          </>
        }
      />
      <RevealSection className="home-section" aria-labelledby="shape-heading">
        <div>
          <p className="eyebrow">What happens</p>
          <h2 id="shape-heading">Working together.</h2>
        </div>
        <div className="meeting-prose">
          <p className="muted">
            A topic or problem is introduced, worked through collaboratively,
            and then discussed. Members compare approaches and defend their
            reasoning rather than racing to an answer. Some weeks we run our own
            in-club contests: problem rounds where members compete with each
            other, at our level, on our own schedule.
          </p>
          <p className="muted">
            Members are expected to arrive prepared and take part. Occasional
            conflicts are normal; the application asks about them directly.
          </p>
        </div>
      </RevealSection>
      <RevealSection aria-labelledby="programme-heading">
        <div className="meeting-programme-heading">
          <p className="eyebrow">Current term</p>
          <h2 id="programme-heading">This term’s programme.</h2>
          <Suspense
            fallback={
              <p className="muted" role="status">
                Loading the term focus…
              </p>
            }
          >
            <TermFocus content={focus} />
          </Suspense>
        </div>
        <Suspense
          fallback={
            <div className="home-loading" role="status">
              Loading the programme…
            </div>
          }
        >
          <Programme content={programme} />
        </Suspense>
      </RevealSection>
      <Suspense fallback={<p role="status">Loading recurring meetings...</p>}><RecurringMeeting /></Suspense>
      <RevealSection
        className="home-section"
        aria-labelledby="meeting-details-heading"
      >
        <div>
          <p className="eyebrow">For members</p>
          <h2 id="meeting-details-heading">Session details.</h2>
        </div>
        <div className="plated">
          <div className="home-panel">
            <p className="muted">
              Session dates, materials, and attendance are private. Sign in to open member services.
            </p>
            <ActionLink href="/dashboard">Open member dashboard</ActionLink>
          </div>
        </div>
      </RevealSection>
      <RevealSection className="public-page-actions" aria-label="Explore LOGOS">
        <ActionLink href="/apply" variant="primary">
          Apply to LOGOS
        </ActionLink>
        <ActionLink href="/join">Who can join</ActionLink>
      </RevealSection>
    </div>
  );
}

export const dynamic = "force-dynamic";

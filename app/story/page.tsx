import type { Metadata } from "next";
import { Suspense } from "react";
import { PageBanner } from "../../components/page-banner.tsx";
import { ActionLink } from "../../components/action.tsx";
import { RevealSection } from "../../components/reveal-section.tsx";
import { ContentImage } from "../../components/content-image.tsx";
import { PostImageGallery } from "../../components/post-image-gallery.tsx";
import {
  getPublishedStories,
  type PublicStory,
} from "../../src/content/operations.ts";
import { readPublic, type PublicRead } from "../../src/content/public-read.ts";
import { getDatabase } from "../../src/server/database.ts";
import { formatDisplayDate } from "../../src/presentation/date.ts";

export const metadata: Metadata = {
  title: "Our story",
  description:
    "The history of LOGOS: its founding, milestones, achievements, and development over time.",
};

async function StoryEntries({
  content,
}: {
  content: Promise<PublicRead<readonly PublicStory[]>>;
}) {
  const result = await content;
  if (result.status === "unavailable")
    return (
      <div className="home-rule story-state">
        <p className="muted">
          Story entries are temporarily unavailable. Please try again later.
        </p>
        <a href="/story" className="home-text-link">
          Reload story
        </a>
      </div>
    );
  if (result.data.length === 0)
    return (
      <div className="home-rule story-state muted">
        No milestones have been published yet.
      </div>
    );
  return (
    <ol className="story-record" aria-label="Club history, oldest first">
      {result.data.toSorted((a, b) => a.occurred_on.getTime() - b.occurred_on.getTime()).map((entry, index) => (
        <li key={entry.id}>
          <article
            className="story-entry"
            aria-labelledby={`story-${entry.id}`}
          >
            <div>
              <time
                className="datum story-date"
                dateTime={entry.occurred_on.toISOString().slice(0, 10)}
              >
                {formatDisplayDate(entry.occurred_on, "UTC")}
              </time>
              <h3 id={`story-${entry.id}`}>{entry.title}</h3>
            </div>
            {entry.image_id ? (
              <div className="plated">
                <figure className="home-panel story-figure">
                  <ContentImage
                    key={entry.image_id}
                    id={entry.image_id}
                    alt={entry.image_alt ?? ""}
                    width={entry.image_width}
                    height={entry.image_height}
                    unavailableMessage="Story image unavailable."
                    priority={index === 0}
                  />
                </figure>
              </div>
            ) : null}
            <PostImageGallery images={entry.additional_images} story priority={index === 0 && !entry.image_id} />
            {entry.description.trim() ? (
              <div className="story-description muted">
                {entry.description
                  .split(/\n{2,}/)
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
              </div>
            ) : null}
          </article>
        </li>
      ))}
    </ol>
  );
}

export default function StoryPage() {
  const content = readPublic(() => getPublishedStories(getDatabase()));
  return (
    <div className="story-page">
      <PageBanner
        className="story-banner"
        scene="collapse"
        theme="ascii-theme-sand"
        titleId="story-heading"
        eyebrow="Our story"
        title={
          <>
            How we’ve
            <br />
            grown.
          </>
        }
        subtitle="The founding, milestones, and achievements that have shaped LOGOS over time."
        actions={<ActionLink href="/join">How to join</ActionLink>}
      />
      <RevealSection aria-labelledby="record-heading">
        <div className="story-record-heading">
          <p className="eyebrow">Our history</p>
          <h2 id="record-heading">Milestones along the way.</h2>
        </div>
        <Suspense
          fallback={
            <div className="story-state home-loading" role="status">
              Loading the club’s history…
            </div>
          }
        >
          <StoryEntries content={content} />
        </Suspense>
      </RevealSection>
      <RevealSection
        className="home-closing plated"
        aria-labelledby="story-cta"
      >
        <div className="home-panel hatched">
          <div>
            <h2 id="story-cta">Help shape what comes next.</h2>
            <p className="muted">Grades 9-12.</p>
          </div>
          <ActionLink href="/apply" variant="primary">
            Apply to LOGOS
          </ActionLink>
        </div>
      </RevealSection>
    </div>
  );
}

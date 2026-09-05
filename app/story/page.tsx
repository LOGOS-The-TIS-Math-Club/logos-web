import type { Metadata } from "next";

import { PageBanner } from "@/components/layout/page-banner";
import { ActionLink } from "@/components/ui/action";
import { ContentImage } from "@/components/ui/content-image";
import { Reveal } from "@/components/ui/reveal";
import { formatSessionDate } from "@/content/club";
import { type PublicStoryEntry } from "@/lib/story/schema";
import { listPublishedStoryEntries } from "@/lib/story/service.server";

export const metadata: Metadata = {
  title: "Our story",
  description:
    "How LOGOS started and what the club has done since — in the club's own record, session by session.",
};

/*
 * The club's history.
 *
 * Entries come from the database so leadership can add one the week it happens
 * rather than the next time somebody edits the code. A failure here shows the
 * empty state rather than taking the page down: a missing history is a much
 * smaller problem than a broken page.
 */
export default async function StoryPage() {
  let entries: PublicStoryEntry[] = [];
  try {
    entries = await listPublishedStoryEntries();
  } catch {
    entries = [];
  }

  return (
    <div className="space-y-24 sm:space-y-32">
      <PageBanner
        scene="collapse"
        theme="ascii-theme-sand"
        titleId="story-heading"
        eyebrow="Our story"
        title={
          <>
            What we&rsquo;ve
            <br />
            done so far.
          </>
        }
        subtitle="The club's own record — the sessions, the problems, and the people who turned up."
        actions={<ActionLink href="/join">How to join</ActionLink>}
      />

      <Reveal as="section" aria-labelledby="record-heading">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="eyebrow">The record</p>
          <h2 id="record-heading" className="heading-1">
            Session by session.
          </h2>
        </div>

        {entries.length === 0 ? (
          <div className="border-border text-muted-foreground mx-auto mt-10 max-w-3xl border-t border-b px-2 py-12 text-sm">
            The club has not written up anything yet. Come to a Friday meeting
            in Room 101 and you will be part of the first entry.
          </div>
        ) : (
          <ol className="mx-auto mt-12 max-w-3xl space-y-16">
            {entries.map((entry, index) => (
              <li key={entry.id}>
                <article className="space-y-5">
                  <div className="space-y-2">
                    <p className="datum text-primary text-xs">
                      {formatSessionDate(entry.occurredOn)}
                    </p>
                    <h3 className="text-2xl font-bold tracking-[-0.02em] text-balance">
                      {entry.title}
                    </h3>
                  </div>

                  {entry.imageId ? (
                    <div className="plated">
                      <figure className="panel-lifted overflow-hidden">
                        <ContentImage
                          imageId={entry.imageId}
                          alt={entry.imageAlt ?? ""}
                          width={entry.imageWidth}
                          height={entry.imageHeight}
                          priority={index === 0}
                        />
                      </figure>
                    </div>
                  ) : null}

                  {/* Blank lines in the entry become paragraphs. Leadership
                      writes these in a plain textarea, so this is the whole of
                      the formatting — no markup is interpreted. */}
                  <div className="text-muted-foreground space-y-4 leading-relaxed">
                    {entry.body
                      .split(/\n{2,}/)
                      .map((paragraph: string) => paragraph.trim())
                      .filter((paragraph: string) => paragraph.length > 0)
                      .map((paragraph: string, paragraphIndex: number) => (
                        <p key={paragraphIndex}>{paragraph}</p>
                      ))}
                  </div>
                </article>
              </li>
            ))}
          </ol>
        )}
      </Reveal>

      <Reveal as="section" aria-labelledby="story-cta">
        <div className="plated">
          <div className="panel-lifted hatched flex flex-col items-start gap-6 p-10 sm:flex-row sm:items-center sm:justify-between sm:p-12">
            <div className="space-y-2">
              <h2 id="story-cta" className="heading-2">
                Want to be in the next one?
              </h2>
              <p className="text-muted-foreground text-sm">
                Grades 9&ndash;12. Every Friday, Room 101.
              </p>
            </div>
            <ActionLink href="/apply" variant="primary">
              Apply to LOGOS
            </ActionLink>
          </div>
        </div>
      </Reveal>
    </div>
  );
}

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
    "The moments that made LOGOS — how the club started, and what it has built since.",
};

/*
 * The club's history — milestones, not a weekly log.
 *
 * Entries are meant to be sparse and significant: the founding, a first
 * competition, the session where something clicked. A page with one entry per
 * Friday reads as an archive nobody opens; a page with eight entries across a
 * year reads as a history. The layout leans on that assumption — each entry is
 * given room rather than compressed into a list.
 *
 * A read failure shows the empty state rather than taking the page down: a
 * missing history is a much smaller problem than a broken page.
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
            The moments
            <br />
            that made us.
          </>
        }
        subtitle="Not every Friday — the ones that changed something. How LOGOS started, and what it has built since."
        actions={<ActionLink href="/join">How to join</ActionLink>}
      />

      <Reveal as="section" aria-labelledby="record-heading">
        <div className="mx-auto max-w-3xl space-y-4">
          <p className="eyebrow">Milestones</p>
          <h2 id="record-heading" className="heading-1">
            What we&rsquo;ll remember.
          </h2>
        </div>

        {entries.length === 0 ? (
          <div className="border-border text-muted-foreground mx-auto mt-10 max-w-3xl border-t border-b px-2 py-12 text-sm">
            Nothing recorded yet — the club&rsquo;s first milestone is still
            ahead of it. Come to a Friday meeting in Room 101 and you will be
            part of it.
          </div>
        ) : (
          <ol className="mx-auto mt-12 max-w-3xl space-y-20 sm:space-y-28">
            {entries.map((entry, index) => {
              // A year marker on the first entry of each year. With sparse,
              // significant entries this reads as a timeline; with one entry a
              // week it would be noise, which is part of why the page is
              // framed around milestones rather than meetings.
              const year = entry.occurredOn.slice(0, 4);
              const isNewYear =
                index === 0 ||
                entries[index - 1].occurredOn.slice(0, 4) !== year;

              return (
                <li key={entry.id}>
                  {isNewYear ? (
                    <p
                      aria-hidden="true"
                      className="datum text-subtle-foreground border-border mb-8 border-t pt-4 text-xs"
                    >
                      {year}
                    </p>
                  ) : null}
                  <article className="space-y-5">
                    <div className="space-y-3">
                      <p className="datum text-primary text-xs">
                        {formatSessionDate(entry.occurredOn)}
                      </p>
                      <h3 className="text-3xl leading-[1.1] font-bold tracking-[-0.025em] text-balance sm:text-4xl">
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
              );
            })}
          </ol>
        )}
      </Reveal>

      <Reveal as="section" aria-labelledby="story-cta">
        <div className="plated">
          <div className="panel-lifted hatched flex flex-col items-start gap-6 p-10 sm:flex-row sm:items-center sm:justify-between sm:p-12">
            <div className="space-y-2">
              <h2 id="story-cta" className="heading-2">
                Want to be part of the next one?
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

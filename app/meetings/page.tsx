import type { Metadata } from "next";

import { PageBanner } from "@/components/layout/page-banner";
import { ActionLink } from "@/components/ui/action";
import { Reveal } from "@/components/ui/reveal";
import { formatSessionDate, SEMESTER_FOCUS, SESSIONS } from "@/content/club";

export const metadata: Metadata = {
  title: "Meetings",
  description:
    "LOGOS meets every Friday after school, 15:30–16:30, in Room 101 at Tokyo International School.",
};

const FACTS = [
  { label: "Every", value: "Friday", note: "After school" },
  { label: "Time", value: "15:30–16:30", note: "One hour" },
  { label: "Location", value: "Room 101", note: "In person" },
] as const;

export default function MeetingsPage() {
  return (
    <div className="space-y-24 sm:space-y-32">
      <PageBanner
        variant="wave"
        titleId="meetings-title"
        eyebrow="Meetings"
        title={
          <>
            One hour,
            <br />
            every Friday.
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

      <section aria-labelledby="facts-heading">
        <h2 id="facts-heading" className="sr-only">
          Where and when
        </h2>
        <dl className="border-border divide-border grid grid-cols-1 divide-y border-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {FACTS.map((fact) => (
            <div key={fact.label} className="px-2 py-10 sm:px-8">
              <dt className="eyebrow">{fact.label}</dt>
              <dd className="datum text-foreground mt-3 text-3xl font-medium sm:text-4xl">
                {fact.value}
              </dd>
              <dd className="text-subtle-foreground mt-1 text-xs">
                {fact.note}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <Reveal as="section" aria-labelledby="shape-heading">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="eyebrow">What happens</p>
            <h2
              id="shape-heading"
              className="text-3xl font-extrabold tracking-[-0.03em] text-balance"
            >
              The shape of a session.
            </h2>
          </div>
          <div className="space-y-6">
            <p className="text-muted-foreground leading-relaxed">
              A topic or problem is introduced, worked through collaboratively,
              and then discussed. Members compare approaches and defend their
              reasoning rather than racing to an answer. Some weeks we run our
              own in-club contests: problem rounds where members compete with
              each other, at our level, on our own schedule.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Members are expected to arrive prepared and take part. Occasional
              conflicts are normal — the application asks about them directly.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="programme-heading">
        <div className="space-y-8">
          <div className="max-w-2xl space-y-3">
            <p className="eyebrow">2026 programme</p>
            <h2
              id="programme-heading"
              className="text-3xl font-extrabold tracking-[-0.03em] text-balance sm:text-4xl"
            >
              Algebra, in depth.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              {SEMESTER_FOCUS}
            </p>
          </div>

          <ol className="border-border divide-border divide-y border-t border-b">
            {SESSIONS.map((session, index) => (
              <li
                key={session.date}
                className="hover:bg-surface group flex items-baseline gap-6 px-2 py-4 transition-colors duration-200 motion-reduce:transition-none"
              >
                <span
                  className="datum text-subtle-foreground w-8 shrink-0 text-xs"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="datum text-subtle-foreground group-hover:text-primary hidden w-28 shrink-0 text-xs transition-colors duration-200 motion-reduce:transition-none sm:block">
                  {formatSessionDate(session.date)}
                </span>
                <span className="text-sm sm:text-base">{session.topic}</span>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      <Reveal as="section">
        <div className="border-border flex flex-wrap items-center gap-4 border-t pt-10">
          <ActionLink href="/apply" variant="primary">
            Apply to LOGOS
          </ActionLink>
          <ActionLink href="/join">Who can join</ActionLink>
        </div>
      </Reveal>
    </div>
  );
}

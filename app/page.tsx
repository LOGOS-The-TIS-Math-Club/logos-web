import { PageBanner } from "@/components/layout/page-banner";
import { ActionLink } from "@/components/ui/action";
import { Reveal } from "@/components/ui/reveal";
import {
  ANNOUNCEMENTS,
  formatSessionDate,
  SEMESTER_FOCUS,
  SESSIONS,
  splitSessions,
} from "@/content/club";

/*
 * Home — what the club is doing now.
 *
 * The standing explanation of LOGOS lives on /about, /meetings and /join. This
 * page is the public noticeboard: the most recent session, what is coming, the
 * term’s focus, and any announcements.
 *
 * Every factual statement traces to an official document: the session list is
 * the 2026 curriculum from the Drive programmes folder; the meeting day, time,
 * room and grade range are user-confirmed.
 */

export default function Home() {
  // Rendered per request (the root layout opts into dynamic rendering), so
  // "this week" is genuinely current rather than frozen at build time.
  const { past, next } = splitSessions(SESSIONS, new Date());
  const latest = past.length > 0 ? past[past.length - 1] : null;
  const upcoming = SESSIONS.filter(
    (s) => s !== latest && past.indexOf(s) === -1,
  );

  return (
    <div className="space-y-24 sm:space-y-32">
      <PageBanner
        scene="collapse"
        theme="ascii-theme-violet"
        titleId="hero-heading"
        eyebrow="Tokyo International School · Grades 9–12"
        title={
          <>
            Mathematics,
            <br />
            taken seriously.
          </>
        }
        subtitle="The student-led mathematics club of Tokyo International School. Every Friday in Room 101."
        actions={
          <>
            <ActionLink href="/apply" variant="primary">
              Apply to LOGOS
            </ActionLink>
            <ActionLink href="/about">About the club</ActionLink>
          </>
        }
      />

      {/* ---------------- This week ---------------- */}
      <Reveal as="section" aria-labelledby="week-heading">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="eyebrow">Latest session</p>
            <h2
              id="week-heading"
              className="text-3xl font-extrabold tracking-[-0.03em] text-balance"
            >
              What we did.
            </h2>
          </div>

          {latest ? (
            <div className="plated">
              <div className="panel-lifted space-y-4 p-8">
                <p className="datum text-primary text-xs">
                  {formatSessionDate(latest.date)}
                </p>
                <p className="text-2xl font-bold tracking-[-0.02em] text-balance">
                  {latest.topic}
                </p>
                {latest.note ? (
                  <p className="text-muted-foreground leading-relaxed">
                    {latest.note}
                  </p>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="panel ruled-left space-y-3 border-l-2 p-8">
              <p className="text-xl font-bold">The term has not started yet.</p>
              <p className="text-muted-foreground">
                Our first session is{" "}
                <span className="datum text-foreground">
                  {formatSessionDate(SESSIONS[0].date)}
                </span>
                . Applications are open now.
              </p>
            </div>
          )}
        </div>
      </Reveal>

      {/* ---------------- Coming up ---------------- */}
      <Reveal as="section" aria-labelledby="plan-heading">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="eyebrow">This term</p>
            <h2
              id="plan-heading"
              className="text-3xl font-extrabold tracking-[-0.03em] text-balance"
            >
              Where we’re going.
            </h2>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {SEMESTER_FOCUS}
            </p>
          </div>

          <ol className="border-border divide-border divide-y border-t border-b">
            {upcoming.map((session) => (
              <li
                key={session.date}
                className="hover:bg-surface group flex items-baseline gap-6 px-2 py-4 transition-colors duration-200 motion-reduce:transition-none"
              >
                <span className="datum text-subtle-foreground group-hover:text-primary w-24 shrink-0 text-xs transition-colors duration-200 motion-reduce:transition-none">
                  {formatSessionDate(session.date)}
                </span>
                <span className="text-sm sm:text-base">{session.topic}</span>
                {session === next ? (
                  <span className="eyebrow text-primary ml-auto shrink-0">
                    Next
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      {/* ---------------- Announcements ---------------- */}
      <Reveal as="section" aria-labelledby="news-heading">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="eyebrow">Notices</p>
            <h2
              id="news-heading"
              className="text-3xl font-extrabold tracking-[-0.03em] text-balance"
            >
              Announcements.
            </h2>
          </div>

          {ANNOUNCEMENTS.length > 0 ? (
            <ul className="space-y-4">
              {ANNOUNCEMENTS.map((item) => (
                <li
                  key={item.title}
                  className="panel panel-interactive ruled-left border-l-2 p-6"
                >
                  <p className="datum text-subtle-foreground text-xs">
                    {formatSessionDate(item.date)}
                  </p>
                  <p className="mt-2 font-semibold">{item.title}</p>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-border text-muted-foreground border-t border-b px-2 py-10 text-sm">
              No announcements right now. Meeting details stay the same: every
              Friday, 15:30–16:30, Room 101.
            </div>
          )}
        </div>
      </Reveal>

      {/* ---------------- Closing ---------------- */}
      <Reveal as="section" aria-labelledby="cta-heading">
        <div className="plated">
          <div className="panel-lifted hatched flex flex-col items-start gap-6 p-10 sm:flex-row sm:items-center sm:justify-between sm:p-12">
            <div className="space-y-2">
              <h2
                id="cta-heading"
                className="text-2xl font-extrabold tracking-[-0.025em] sm:text-3xl"
              >
                Want to join?
              </h2>
              <p className="text-muted-foreground text-sm">
                Grades 9–12. No prior competition experience required.
              </p>
            </div>
            <ActionLink href="/apply" variant="primary">
              Apply to LOGOS
            </ActionLink>
          </div>
        </div>
      </Reveal>

      {/* Sticky mobile action. */}
      <div className="bg-surface/95 border-border fixed inset-x-0 bottom-0 z-40 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <ActionLink
          href="/apply"
          variant="primary"
          className="w-full justify-center"
        >
          Apply to LOGOS
        </ActionLink>
      </div>
      <div
        aria-hidden="true"
        className="h-[calc(5rem+env(safe-area-inset-bottom))] md:hidden"
      />
    </div>
  );
}

import { AsciiField } from "@/components/brand/ascii-field";
import { LogosLogomark } from "@/components/brand/marks";
import { ActionLink } from "@/components/ui/action";
import { Reveal } from "@/components/ui/reveal";

/*
 * Public recruitment landing page.
 *
 * Every factual statement here traces to an official LOGOS document:
 * - purpose, mission, founding, student-led model: logos-doc-root (charter)
 * - session topics: 03-programs/logos-data-curriculum-2026.xlsx
 * - meeting day, time, room, grade range: user-confirmed
 *
 * Claims previously on this page that appear in no official document — AMC,
 * AIME, CEMC/Euclid/Fermat, "Olympiad", a Google Classroom archive, graph
 * theory and modular arithmetic, and invented leadership roles — have been
 * removed rather than restated.
 */

const ACTIVITIES = [
  {
    title: "Collaborative problem-solving",
    body: "We work through non-routine problems together, comparing approaches and defending the reasoning rather than racing to an answer.",
  },
  {
    title: "Discussion and presentations",
    body: "Members present ideas to each other. Explaining a proof out loud is where most of the learning actually happens.",
  },
  {
    // In-club contests only. LOGOS has not entered an external competition,
    // so nothing here may imply one.
    title: "In-club competitions",
    body: "We run our own contests inside the club — problem rounds where members compete with each other, at our level, on our own schedule.",
  },
] as const;

// From the 2026 curriculum in the official programmes folder.
const TOPICS = [
  "Algebra diagnostic and introduction",
  "Multiplication identities and polynomial structure",
  "Factoring complex polynomial expressions",
  "Identities and undetermined coefficients",
  "Remainder theorem and factor theorem",
  "Real and complex numbers",
  "Roots, discriminants, and root–coefficient relationships",
  "Structural methods for cubic and quartic equations",
] as const;

const STEPS = [
  {
    title: "Sign in with your school account",
    body: "Google sign-in confirms you are a Tokyo International School student. It does not make you a member.",
  },
  {
    title: "Answer eight short questions",
    body: "Your name, grade, what interests you, and whether Friday afternoons work. It takes about five minutes.",
  },
  {
    title: "Leadership reviews your application",
    body: "We read every application and reply to your school email address.",
  },
] as const;

const FAQ = [
  {
    question: "Do I need competition experience?",
    answer:
      "No. The club is open to any student in Grades 9–12 who wants to work at mathematics seriously. Curiosity is the only prerequisite.",
  },
  {
    question: "Does signing in with Google make me a member?",
    answer:
      "No. Signing in only proves you control a Tokyo International School account, which stops duplicate and impersonated applications. Membership is a separate decision made by club leadership after reviewing your application.",
  },
  {
    question: "What actually happens in a meeting?",
    answer:
      "One hour of mathematics: a problem or topic introduced, worked through collaboratively, and discussed. Members are expected to arrive prepared and take part.",
  },
  {
    question: "What if I miss a Friday?",
    answer:
      "Occasional conflicts are normal and the application asks about them directly. Tell us honestly — it will not count against you.",
  },
] as const;

export default function Home() {
  return (
    <div className="-mt-8 space-y-24 sm:-mt-12 sm:space-y-32">
      {/* ---------------- 1. Hero ---------------- */}
      <section
        aria-labelledby="hero-heading"
        className="bleed border-border relative border-b"
      >
        <div className="relative grid min-h-[76svh] grid-cols-1 items-center lg:min-h-[86svh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {/* Mathematical field. Decorative; the heading carries the meaning. */}
          <div className="absolute inset-0 lg:left-1/2">
            <AsciiField />
            <div className="ascii-fallback">
              <LogosLogomark className="h-40 w-40 opacity-40" />
            </div>
          </div>

          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="panel-lifted hatched max-w-xl space-y-7 p-8 sm:p-10">
              <p className="eyebrow enter enter-1">
                Tokyo International School · Grades 9–12
              </p>

              <h1
                id="hero-heading"
                className="enter enter-2 text-4xl leading-[1.05] font-extrabold tracking-[-0.03em] text-balance sm:text-6xl"
              >
                Mathematics,
                <br />
                taken seriously.
              </h1>

              <p className="enter enter-3 text-muted-foreground max-w-md text-base leading-relaxed sm:text-lg">
                LOGOS is the student-led mathematics club of Tokyo International
                School. We meet every Friday in Room 101 to work through
                problems that reward careful reasoning.
              </p>

              <div className="enter enter-4 flex flex-wrap items-center gap-3">
                <ActionLink href="/apply" variant="primary">
                  Apply to LOGOS
                </ActionLink>
                <ActionLink href="#meetings">What happens</ActionLink>
              </div>

              <p className="enter enter-5 text-subtle-foreground text-xs">
                No prior competition experience is required.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 2. Meeting facts ---------------- */}
      <section id="meetings" aria-labelledby="meetings-heading">
        <h2 id="meetings-heading" className="sr-only">
          Meeting schedule
        </h2>
        <dl className="border-border divide-border grid grid-cols-1 divide-y border-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { label: "Every", value: "Friday", note: "After school" },
            { label: "Time", value: "15:30–16:30", note: "One hour" },
            { label: "Location", value: "Room 101", note: "In person" },
          ].map((fact) => (
            <div key={fact.label} className="px-2 py-8 sm:px-8">
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

      {/* ---------------- 3. What we do ---------------- */}
      <Reveal as="section" id="about" aria-labelledby="about-heading">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="space-y-5">
            <p className="eyebrow">What we do</p>
            <h2
              id="about-heading"
              className="text-3xl font-extrabold tracking-[-0.025em] text-balance sm:text-4xl"
            >
              A club built on reasoning, not recall.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              LOGOS exists to develop rigorous logical thought through the
              disciplined study of mathematics — precision in analysis,
              coherence in argument, and independence in thought.
            </p>
            <p className="text-subtle-foreground text-sm leading-relaxed">
              Founded in early 2025, LOGOS is the first club at Tokyo
              International School to operate under a fully student-driven
              model. Teacher supervisors advise and support; the members run it.
            </p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            {ACTIVITIES.map((activity, index) => (
              <li
                key={activity.title}
                className="panel panel-interactive flex gap-5 p-6"
              >
                <span
                  className="datum text-primary-muted shrink-0 text-sm"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="space-y-2">
                  <h3 className="font-semibold">{activity.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {activity.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>

      {/* ---------------- 4. This year's mathematics ---------------- */}
      <Reveal as="section" aria-labelledby="topics-heading">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="space-y-5">
            <p className="eyebrow">This year</p>
            <h2
              id="topics-heading"
              className="text-3xl font-extrabold tracking-[-0.025em] text-balance sm:text-4xl"
            >
              Algebra, in depth.
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              The 2026 programme works through algebraic structure carefully
              rather than covering many topics quickly. Sessions build on each
              other.
            </p>
          </div>

          <ol className="border-border divide-border divide-y border-t border-b">
            {TOPICS.map((topic, index) => (
              <li
                key={topic}
                className="hover:bg-surface flex items-baseline gap-5 px-2 py-4 transition-colors duration-150 motion-reduce:transition-none"
              >
                <span
                  className="datum text-subtle-foreground w-8 shrink-0 text-xs"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-sm sm:text-base">{topic}</span>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      {/* ---------------- 5. Who can join ---------------- */}
      <Reveal as="section" id="join" aria-labelledby="join-heading">
        <div className="space-y-8">
          <div className="max-w-2xl space-y-4">
            <p className="eyebrow">Who can join</p>
            <h2
              id="join-heading"
              className="text-3xl font-extrabold tracking-[-0.025em] text-balance sm:text-4xl"
            >
              Open to every high school student.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="panel-lifted space-y-3 p-8">
              <h3 className="text-xl font-bold">
                No prior experience required
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Whether you have competed before or have simply never been given
                a problem that took more than a minute, you are welcome. We
                start from reasoning, not from a syllabus.
              </p>
            </div>
            <div className="panel space-y-3 p-8">
              <h3 className="text-xl font-bold">Grades 9 through 12</h3>
              <p className="text-muted-foreground leading-relaxed">
                Open to all Tokyo International School high school students. We
                ask members to arrive prepared and attend regularly — one hour a
                week, taken seriously.
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* ---------------- 6. How to apply ---------------- */}
      <Reveal as="section" aria-labelledby="how-heading">
        <div className="space-y-10">
          <div className="max-w-2xl space-y-4">
            <p className="eyebrow">How to apply</p>
            <h2
              id="how-heading"
              className="text-3xl font-extrabold tracking-[-0.025em] text-balance sm:text-4xl"
            >
              Three steps, about five minutes.
            </h2>
          </div>

          <ol className="grid gap-4 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="panel panel-interactive space-y-3 p-7"
              >
                <span
                  className="datum text-primary text-2xl"
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>

      {/* ---------------- 7. FAQ + closing ---------------- */}
      <Reveal as="section" aria-labelledby="faq-heading" className="space-y-12">
        <div className="grid gap-12 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-4">
            <p className="eyebrow">Questions</p>
            <h2
              id="faq-heading"
              className="text-3xl font-extrabold tracking-[-0.025em] text-balance sm:text-4xl"
            >
              Before you apply.
            </h2>
          </div>

          <div className="border-border divide-border divide-y border-t border-b">
            {FAQ.map((item) => (
              <details key={item.question} className="group">
                <summary className="hover:text-primary focus-visible:outline-focus flex cursor-pointer items-center justify-between gap-6 py-5 font-medium transition-colors duration-150 marker:content-none focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="text-subtle-foreground shrink-0 text-lg transition-transform duration-200 group-open:rotate-45 motion-reduce:transition-none"
                  >
                    +
                  </span>
                </summary>
                <p className="text-muted-foreground max-w-2xl pb-6 text-sm leading-relaxed">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>

        <div className="panel-lifted hatched flex flex-col items-start gap-6 p-10 sm:flex-row sm:items-center sm:justify-between sm:p-12">
          <div className="space-y-2">
            <h2 className="text-2xl font-extrabold tracking-[-0.02em] sm:text-3xl">
              Ready to apply?
            </h2>
            <p className="text-muted-foreground text-sm">
              Sign in with your school account and answer eight short questions.
            </p>
          </div>
          <ActionLink href="/apply" variant="primary">
            Apply to LOGOS
          </ActionLink>
        </div>
      </Reveal>

      {/* Sticky mobile action. Hidden once the closing CTA is on screen would
          require JS; instead it simply stays available on small viewports. */}
      <div className="bg-surface/95 border-border fixed inset-x-0 bottom-0 z-40 border-t p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
        <ActionLink
          href="/apply"
          variant="primary"
          className="w-full justify-center"
        >
          Apply to LOGOS
        </ActionLink>
      </div>
      {/* Spacer matching the sticky bar so the last section is never covered.
          Includes the iOS home-indicator inset. */}
      <div
        aria-hidden="true"
        className="h-[calc(5rem+env(safe-area-inset-bottom))] md:hidden"
      />
    </div>
  );
}

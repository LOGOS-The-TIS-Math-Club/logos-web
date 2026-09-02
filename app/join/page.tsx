import type { Metadata } from "next";

import { ActionLink } from "@/components/ui/action";
import { Reveal } from "@/components/ui/reveal";

export const metadata: Metadata = {
  title: "Join",
  description:
    "LOGOS is open to all Tokyo International School students in Grades 9–12. No prior competition experience is required.",
};

const STEPS = [
  {
    title: "Sign in with your school account",
    body: "Google sign-in confirms you are a Tokyo International School student and stops duplicate or impersonated applications. It does not make you a member.",
  },
  {
    title: "Answer eight short questions",
    body: "Your name, grade, what interests you, why you would like to join, and whether Friday afternoons work. About five minutes.",
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
      "No. Signing in only proves you control a Tokyo International School account. Membership is a separate decision made by club leadership after reviewing your application.",
  },
  {
    question: "What if I miss a Friday?",
    answer:
      "Occasional conflicts are normal and the application asks about them directly. Tell us honestly — it will not count against you.",
  },
  {
    question: "What happens to the information I submit?",
    answer:
      "It is stored securely and seen only by leadership members with explicit review access. We never ask for your address, phone number or any medical information.",
  },
] as const;

export default function JoinPage() {
  return (
    <div className="space-y-24 py-4 sm:space-y-32">
      <header className="max-w-3xl space-y-6">
        <p className="eyebrow enter enter-1">Joining</p>
        <h1 className="enter enter-2 text-4xl font-extrabold tracking-[-0.035em] text-balance sm:text-6xl">
          Open to every high school student.
        </h1>
        <p className="enter enter-3 text-muted-foreground text-lg leading-relaxed">
          All Tokyo International School students in Grades 9–12 are welcome. No
          prior competition experience is required.
        </p>
      </header>

      <Reveal as="section" aria-labelledby="who-heading">
        <h2 id="who-heading" className="sr-only">
          Who can join
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="plated">
            <div className="panel-lifted space-y-3 p-8">
              <h3 className="text-xl font-bold tracking-[-0.015em]">
                No prior experience required
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                Whether you have competed before or have simply never been given
                a problem that took more than a minute, you are welcome. We
                start from reasoning, not from a syllabus.
              </p>
            </div>
          </div>
          <div className="panel ruled-left space-y-3 border-l-2 p-8">
            <h3 className="text-xl font-bold tracking-[-0.015em]">
              Grades 9 through 12
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              One hour a week, taken seriously. We ask members to arrive
              prepared and attend regularly.
            </p>
          </div>
        </div>
      </Reveal>

      <Reveal as="section" aria-labelledby="how-heading">
        <div className="space-y-10">
          <div className="max-w-2xl space-y-3">
            <p className="eyebrow">How to apply</p>
            <h2
              id="how-heading"
              className="text-3xl font-extrabold tracking-[-0.03em] text-balance sm:text-4xl"
            >
              Three steps, about five minutes.
            </h2>
          </div>

          <ol className="border-border grid gap-px border md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="bg-surface hover:bg-surface-raised group space-y-3 p-8 transition-colors duration-250 motion-reduce:transition-none"
              >
                <span
                  className="datum text-primary-muted group-hover:text-primary block text-3xl transition-colors duration-250 motion-reduce:transition-none"
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

      <Reveal as="section" aria-labelledby="faq-heading">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
          <div className="space-y-3">
            <p className="eyebrow">Questions</p>
            <h2
              id="faq-heading"
              className="text-3xl font-extrabold tracking-[-0.03em] text-balance"
            >
              Before you apply.
            </h2>
          </div>

          <div className="border-border divide-border divide-y border-t border-b">
            {FAQ.map((item) => (
              <details key={item.question} className="group">
                <summary className="hover:text-primary focus-visible:outline-focus flex cursor-pointer list-none items-center justify-between gap-6 py-5 font-medium transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="text-subtle-foreground shrink-0 text-lg transition-transform duration-300 group-open:rotate-45 motion-reduce:transition-none"
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
      </Reveal>

      <Reveal as="section">
        <div className="plated">
          <div className="panel-lifted hatched flex flex-col items-start gap-6 p-10 sm:flex-row sm:items-center sm:justify-between sm:p-12">
            <div className="space-y-2">
              <h2 className="text-2xl font-extrabold tracking-[-0.025em] sm:text-3xl">
                Ready?
              </h2>
              <p className="text-muted-foreground text-sm">
                Sign in with your school account and answer eight short
                questions.
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

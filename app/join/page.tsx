import type { Metadata } from "next";
import { PageBanner } from "../../components/page-banner.tsx";
import { ActionLink } from "../../components/action.tsx";
import { RevealSection } from "../../components/reveal-section.tsx";

export const metadata: Metadata = {
  title: "Join",
  description:
    "LOGOS is open to all Tokyo International School students in Grades 9-12. No prior competition experience is required.",
};

// Public joining information and FAQ copy reused from the legacy Join page.
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
      "No. The club is open to any student in Grades 9-12 who wants to work at mathematics seriously. Curiosity is the only prerequisite.",
  },
  {
    question: "Does signing in with Google make me a member?",
    answer:
      "No. Signing in only proves you control a Tokyo International School account. Membership is a separate decision made by club leadership after reviewing your application.",
  },
  {
    question: "What if I miss a Friday?",
    answer:
      "Occasional conflicts are normal and the application asks about them directly. Tell us honestly; it will not count against you.",
  },
  {
    question: "What happens to the information I submit?",
    answer:
      "It is stored securely and seen only by leadership members with explicit review access. We never ask for your address, phone number or any medical information. To correct or withdraw an application, email the club.",
  },
] as const;

export default function JoinPage() {
  return (
    <div className="join-page">
      <PageBanner
        className="join-banner"
        scene="network"
        theme="ascii-theme-emerald"
        titleId="join-title"
        eyebrow="Joining"
        title={
          <>
            Open to every
            <br />
            high school student.
          </>
        }
        subtitle="All Tokyo International School students in Grades 9-12 are welcome. No prior competition experience is required."
        actions={
          <ActionLink href="/apply" variant="primary">
            Apply to LOGOS
          </ActionLink>
        }
      />
      <RevealSection aria-labelledby="who-heading">
        <h2 id="who-heading" className="sr-only">
          Who can join
        </h2>
        <div className="join-eligibility">
          <div className="plated">
            <div className="home-panel">
              <h3>No prior experience required</h3>
              <p className="muted">
                Whether you have competed before or have simply never been given
                a problem that took more than a minute, you are welcome. We
                start from reasoning, not from a syllabus.
              </p>
            </div>
          </div>
          <div className="plated">
            <div className="home-panel">
              <h3>Grades 9 through 12</h3>
              <p className="muted">
                One hour a week, taken seriously. We ask members to arrive
                prepared and attend regularly.
              </p>
            </div>
          </div>
        </div>
      </RevealSection>
      <RevealSection aria-labelledby="how-heading">
        <div className="join-section-heading">
          <p className="eyebrow">How to apply</p>
          <h2 id="how-heading">Three steps, about five minutes.</h2>
        </div>
        <ol className="join-steps">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="step-number" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{step.title}</h3>
              <p className="muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </RevealSection>
      <RevealSection className="home-section" aria-labelledby="faq-heading">
        <div>
          <p className="eyebrow">Questions</p>
          <h2 id="faq-heading">Before you apply.</h2>
        </div>
        <div className="join-faq">
          {FAQ.map((item) => (
            <details key={item.question} className="disclosure">
              <summary>
                {item.question}
                <span className="disclosure-marker" aria-hidden="true">
                  +
                </span>
              </summary>
              <div className="disclosure-body">
                <div>
                  <p className="muted">{item.answer}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      </RevealSection>
      <RevealSection
        className="home-closing plated"
        aria-labelledby="join-ready-heading"
      >
        <div className="home-panel hatched">
          <div>
            <h2 id="join-ready-heading">Ready?</h2>
            <p className="muted">
              Sign in with your school account and answer eight short questions.
            </p>
          </div>
          <ActionLink href="/apply" variant="primary">
            Apply to LOGOS
          </ActionLink>
        </div>
      </RevealSection>
    </div>
  );
}
